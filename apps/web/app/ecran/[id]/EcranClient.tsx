'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { EcranMembre, EcranPayload, EcranRendezVous } from '@/lib/ecran';
import s from './ecran.module.css';

const RAFRAICHISSEMENT_MS = 60_000;
const PALETTE = ['#2563eb', '#db2777', '#059669', '#d97706', '#7c3aed', '#0891b2', '#dc2626', '#4f46e5', '#65a30d', '#ea580c'];

const minutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
const hhmm = (mins: number): string => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

/** « HH:mm » de maintenant dans le fuseau du lieu, pas celui de la TV. */
function heureMaintenant(fuseau: string, instant: Date): string {
  return new Intl.DateTimeFormat('fr-FR', { timeZone: fuseau, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(instant);
}
function jourMaintenant(fuseau: string, instant: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: fuseau, year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant);
}

function couleurMembre(membre: EcranMembre, index: number): string {
  return membre.color || PALETTE[index % PALETTE.length];
}

function initiales(nom: string): string {
  return nom.split(/\s+/).filter(Boolean).slice(0, 2).map((m) => m[0]?.toUpperCase() ?? '').join('');
}

/** Garde l'écran allumé tant que la page est visible (tablettes). */
function useVerrouEcran(actif: boolean) {
  useEffect(() => {
    if (!actif) return;
    type Verrou = { release(): Promise<void> };
    type Nav = Navigator & { wakeLock?: { request(type: 'screen'): Promise<Verrou> } };
    let verrou: Verrou | null = null;
    const demander = async () => {
      try {
        if (document.visibilityState === 'visible') verrou = (await (navigator as Nav).wakeLock?.request('screen')) ?? null;
      } catch { /* refusé : sans conséquence */ }
    };
    void demander();
    document.addEventListener('visibilitychange', demander);
    return () => { document.removeEventListener('visibilitychange', demander); void verrou?.release(); };
  }, [actif]);
}

/**
 * `demo` : données fictives fournies par la page de démonstration — pas de
 * rafraîchissement réseau, pas de verrou d'écran, et une heure simulée pour
 * que la ligne « maintenant » tombe toujours au milieu de la journée.
 */
export function EcranClient({ initial, id, secret, demo }: { initial: EcranPayload; id: string; secret: string; demo?: { heure: string } }) {
  const [donnees, setDonnees] = useState(initial);
  const [maintenant, setMaintenant] = useState(() => new Date());
  const [panne, setPanne] = useState(false);
  useVerrouEcran(!demo);
  useEffect(() => { setDonnees(initial); }, [initial]);

  // L'horloge bat toutes les 15 s : assez pour la ligne « maintenant » et
  // l'heure affichée, sans réveiller la TV en permanence.
  useEffect(() => {
    const id = setInterval(() => setMaintenant(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);

  // Rafraîchissement : toutes les 60 s, et dès que l'onglet redevient
  // visible. Une erreur ne vide jamais l'écran : on garde la dernière
  // journée connue et on signale discrètement que la liaison est coupée.
  useEffect(() => {
    if (demo) return;
    let annule = false;
    const charger = async () => {
      try {
        const res = await fetch(`/api/ecran/${encodeURIComponent(id)}?k=${encodeURIComponent(secret)}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(String(res.status));
        const corps = (await res.json()) as EcranPayload;
        if (!annule) { setDonnees(corps); setPanne(false); }
      } catch {
        if (!annule) setPanne(true);
      }
    };
    const timer = setInterval(charger, RAFRAICHISSEMENT_MS);
    const visible = () => { if (document.visibilityState === 'visible') void charger(); };
    document.addEventListener('visibilitychange', visible);
    return () => { annule = true; clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
  }, [id, secret, demo]);

  const { fuseau, membres, rendezVous, indispos, ecran, provider, lieu } = donnees;
  const heureNow = demo?.heure ?? heureMaintenant(fuseau, maintenant);
  const minNow = minutes(heureNow);
  // La journée affichée est celle du serveur ; si la TV passe minuit
  // avant le prochain rafraîchissement, la ligne « maintenant » se cache.
  const memeJour = Boolean(demo) || jourMaintenant(fuseau, maintenant) === donnees.jour;

  // Amplitude horaire : des horaires d'ouverture et des rendez-vous, à
  // l'heure ronde, et jamais moins de 8 h–20 h pour garder une échelle
  // stable d'un jour à l'autre.
  const { debutGrille, finGrille } = useMemo(() => {
    let debut = 8 * 60, fin = 20 * 60;
    for (const m of membres) for (const h of m.horaires) { debut = Math.min(debut, minutes(h.start)); fin = Math.max(fin, minutes(h.end)); }
    for (const r of rendezVous) { debut = Math.min(debut, minutes(r.debutLocal)); fin = Math.max(fin, minutes(r.finLocal)); }
    return { debutGrille: Math.floor(debut / 60) * 60, finGrille: Math.min(24 * 60, Math.ceil(fin / 60) * 60) };
  }, [membres, rendezVous]);
  const dureeGrille = Math.max(60, finGrille - debutGrille);
  const pct = (mins: number) => `${((Math.min(Math.max(mins, debutGrille), finGrille) - debutGrille) / dureeGrille) * 100}%`;
  const heures = useMemo(() => { const out: number[] = []; for (let h = debutGrille; h < finGrille; h += 60) out.push(h); return out; }, [debutGrille, finGrille]);

  const parMembre = useMemo(() => {
    const map = new Map<string, EcranRendezVous[]>();
    for (const r of rendezVous) { const cle = r.memberId ?? membres[0]?.id ?? ''; map.set(cle, [...(map.get(cle) ?? []), r]); }
    return map;
  }, [rendezVous, membres]);
  const couleurs = useMemo(() => new Map(membres.map((m, i) => [m.id, couleurMembre(m, i)])), [membres]);
  const nomMembre = useMemo(() => new Map(membres.map((m) => [m.id, m.name])), [membres]);

  // Panneau : ce qui est en cours, puis ce qui vient.
  const aVenir = useMemo(() => {
    if (!memeJour) return rendezVous.slice(0, ecran.upcomingCount);
    return rendezVous.filter((r) => minutes(r.finLocal) > minNow).slice(0, ecran.upcomingCount);
  }, [rendezVous, minNow, ecran.upcomingCount, memeJour]);

  const compteurs = useMemo(() => {
    const total = rendezVous.length;
    const termines = memeJour ? rendezVous.filter((r) => minutes(r.finLocal) <= minNow).length : 0;
    const enCours = memeJour ? rendezVous.filter((r) => minutes(r.debutLocal) <= minNow && minutes(r.finLocal) > minNow).length : 0;
    // Pas de taux de remplissage : l'écran est visible du public, et le
    // client ne veut pas donner cette information.
    return { total, termines, enCours, restants: total - termines - enCours };
  }, [rendezVous, minNow, memeJour]);

  const dateLongue = new Intl.DateTimeFormat('fr-FR', { timeZone: fuseau, weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${donnees.jour}T12:00:00Z`));
  const avecPanneau = ecran.upcomingCount > 0 || ecran.showCounters;
  // Ce qu'on montre du client : le prénom, la prestation, ou les deux.
  const montrerPrenom = ecran.clientDisplay !== 'service';
  const montrerPrestation = ecran.clientDisplay !== 'name';

  return <div className={s.ecran} data-theme={ecran.theme} data-panneau={avecPanneau}>
    <header className={s.entete}>
      <div className={s.marque}>
        {provider.photoURL
          ? <Image src={provider.photoURL} alt="" width={64} height={64} className={s.logo} unoptimized />
          : <span className={s.logoLettres}>{initiales(provider.businessName)}</span>}
        <div><h1>{provider.businessName}</h1>{lieu.name && <p>{lieu.name}</p>}</div>
      </div>
      <div className={s.opatam} aria-label="Opatam">
        <Image src={ecran.theme === 'dark' ? '/logo-opatam-blanc.png' : '/logo-opatam.png'} alt="" width={30} height={30} />
        <span>OPATAM</span>
      </div>
      <div className={s.horloge}>
        <p className={s.date}>{dateLongue}</p>
        <p className={s.heure} aria-live="off">{heureNow}</p>
      </div>
    </header>

    <main className={s.corps}>
      <section className={s.agenda} aria-label="Agenda du jour" style={{ '--membres': Math.max(1, membres.length), '--heures': heures.length } as React.CSSProperties}>
        <div className={s.colonnesTitres} style={{ gridTemplateColumns: `var(--axe) repeat(${Math.max(1, membres.length)}, minmax(0, 1fr))` }}>
          <div />
          {/* La cellule mesure sa largeur ; la carte à l'intérieur s'y adapte
              (une règle @container ne peut pas styler son propre conteneur). */}
          {membres.map((m, i) => <div key={m.id} className={s.membreCellule}><div className={s.membreTitre} style={{ '--c': couleurMembre(m, i) } as React.CSSProperties}>
            {m.photoURL ? <Image src={m.photoURL} alt="" width={40} height={40} unoptimized /> : <span>{initiales(m.name)}</span>}
            <strong>{m.name}</strong>
            <small>{m.horaires.length ? m.horaires.map((h) => `${h.start}–${h.end}`).join(' · ') : 'Fermé'}</small>
          </div></div>)}
        </div>
        <div className={s.grille} style={{ gridTemplateColumns: `var(--axe) repeat(${Math.max(1, membres.length)}, minmax(0, 1fr))` }}>
          <div className={s.axe}>{heures.map((h) => <span key={h} style={{ top: pct(h) }}>{hhmm(h)}</span>)}</div>
          {membres.map((m) => {
            const fermes: { debut: number; fin: number }[] = [];
            let curseur = debutGrille;
            for (const h of [...m.horaires].sort((a, b) => minutes(a.start) - minutes(b.start))) {
              if (minutes(h.start) > curseur) fermes.push({ debut: curseur, fin: minutes(h.start) });
              curseur = Math.max(curseur, minutes(h.end));
            }
            if (curseur < finGrille) fermes.push({ debut: curseur, fin: finGrille });
            return <div key={m.id} className={s.colonne}>
              {heures.map((h) => <i key={h} className={s.ligneHeure} style={{ top: pct(h) }} />)}
              {fermes.map((f, i) => <div key={i} className={s.ferme} style={{ top: pct(f.debut), height: `calc(${pct(f.fin)} - ${pct(f.debut)})` }} />)}
              {indispos.filter((x) => x.memberId === m.id).map((x) => <div key={x.id} className={s.indispo} style={{ top: pct(minutes(x.debutLocal)), height: `calc(${pct(minutes(x.finLocal))} - ${pct(minutes(x.debutLocal))})` }}><span>{x.titre}</span></div>)}
              {(parMembre.get(m.id) ?? []).map((r) => {
                const d = minutes(r.debutLocal), f = Math.max(minutes(r.finLocal), d + 15);
                const enCours = memeJour && d <= minNow && f > minNow;
                const passe = memeJour && f <= minNow;
                return <article key={r.id} className={s.rdv} data-encours={enCours} data-passe={passe} data-attente={r.statut === 'pending'} style={{ top: pct(d), height: `calc(${pct(f)} - ${pct(d)})`, '--c': r.color || couleurs.get(m.id) } as React.CSSProperties}>
                  <div><time>{r.debutLocal}</time><strong>{montrerPrenom ? r.client : r.service}</strong>{montrerPrenom && montrerPrestation && <span>{r.service}</span>}</div>
                </article>;
              })}
            </div>;
          })}
          {memeJour && minNow >= debutGrille && minNow <= finGrille && <div className={s.maintenant} style={{ top: pct(minNow) }}><span>{heureNow}</span></div>}
        </div>
        {!membres.length && <p className={s.vide}>Aucun membre actif dans ce lieu.</p>}
      </section>

      {avecPanneau && <aside className={s.panneau}>
        {ecran.upcomingCount > 0 && <section aria-label="Prochains rendez-vous">
          <h2>{compteurs.enCours ? 'En cours et à venir' : 'Prochains rendez-vous'}</h2>
          {aVenir.length
            ? <ol className={s.liste} style={{ '--n': aVenir.length } as React.CSSProperties}>{aVenir.map((r) => {
              const enCours = memeJour && minutes(r.debutLocal) <= minNow && minutes(r.finLocal) > minNow;
              return <li key={r.id} data-encours={enCours} style={{ '--c': couleurs.get(r.memberId ?? '') ?? PALETTE[0] } as React.CSSProperties}>
                <time>{r.debutLocal}<small>{r.finLocal}</small></time>
                <div><strong>{montrerPrenom ? r.client : r.service}</strong>{montrerPrenom && montrerPrestation && <span>{r.service}</span>}{membres.length > 1 && r.memberId && <em>{nomMembre.get(r.memberId)}</em>}</div>
                {enCours && <b>En cours</b>}
              </li>;
            })}</ol>
            : <p className={s.vide}>{rendezVous.length ? 'La journée est terminée.' : 'Aucun rendez-vous aujourd’hui.'}</p>}
        </section>}
        {ecran.showCounters && <section className={s.compteurs} aria-label="Chiffres du jour">
          <div><b>{compteurs.total}</b><span>aujourd’hui</span></div>
          <div><b>{compteurs.enCours + compteurs.restants}</b><span>à venir</span></div>
          <div><b>{compteurs.termines}</b><span>terminés</span></div>
        </section>}
        {provider.slug && <section className={s.qr} aria-label="Réserver en ligne">
          <div className={s.qrCode}><QRCodeSVG value={`https://opatam.com/p/${provider.slug}`} size={128} level="M" bgColor="#ffffff" fgColor="#0b1020" /></div>
          <div>
            <strong>Prenez rendez-vous</strong>
            <span>Scannez pour réserver en ligne, 24 h/24.</span>
            <small>opatam.com/p/{provider.slug}</small>
          </div>
        </section>}
      </aside>}
    </main>

    <footer className={s.pied}>
      <span>{demo ? 'Démonstration · données fictives' : `${panne ? 'Liaison interrompue · dernière mise à jour ' : 'Mis à jour à '}${heureMaintenant(fuseau, new Date(donnees.genereLe))}`}</span>
      <span>{ecran.label} · Opatam</span>
    </footer>
  </div>;
}
