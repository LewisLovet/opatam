'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Calendar } from 'lucide-react';
import type { CaseOccupation, OccupationPayload } from '@/lib/occupation-types';
import s from './semaine.module.css';

/**
 * Widget « vue semaine » — la présentation, sans savoir d'où viennent les
 * données : la page embarquée lui passe l'occupation réelle, la
 * démonstration des données fictives.
 *
 * Grand écran : grille semaine (7 colonnes). Téléphone : la semaine en
 * carte de chaleur, ou un jour en grandes lignes tactiles.
 */

export type LangueWidget = 'fr' | 'en' | 'it' | 'pt' | 'de';

export interface OptionsSemaineWidget {
  theme: 'light' | 'dark';
  /** Couleur principale, valeur CSS (« #2563eb » ou « rgb(…) »). */
  primaire: string;
  rayon: number;
  legende: boolean;
  lang: LangueWidget;
}

const TEXTES: Record<LangueWidget, Record<string, string>> = {
  fr: { titre: 'Disponibilités', semaine: 'Cette semaine', suivante: 'La suivante', prec: 'Semaine précédente', suiv: 'Semaine suivante', libre: 'Libre', partiel: 'Partiellement pris', complet: 'Complet', passe: 'Passé', aide: 'Cliquez un créneau libre pour réserver.', propulse: 'Propulsé par', vueSemaine: 'Semaine', vueJour: 'Jour', matin: 'Matin', aprem: 'Après-midi', ferme: 'fermé', passeJour: 'passé', fermeJour: 'Fermé ce jour.', jourPasse: 'Ce jour est passé.', termine: 'La journée est terminée.', dispo: 'créneau disponible', dispos: 'créneaux disponibles', places: 'places sur', place: 'place sur', aideMobile: 'Touchez un créneau libre pour réserver, ou un jour pour le détailler.', pros: 'professionnels', avec: 'Avec', chargement: 'Chargement des disponibilités…', erreur: 'Disponibilités indisponibles pour le moment.', dejaPasses: 'créneaux déjà passés aujourd’hui', dejaPasse: 'créneau déjà passé aujourd’hui' },
  en: { titre: 'Availability', semaine: 'This week', suivante: 'Next week', prec: 'Previous week', suiv: 'Next week', libre: 'Free', partiel: 'Partly booked', complet: 'Full', passe: 'Past', aide: 'Click a free slot to book.', propulse: 'Powered by', vueSemaine: 'Week', vueJour: 'Day', matin: 'Morning', aprem: 'Afternoon', ferme: 'closed', passeJour: 'past', fermeJour: 'Closed that day.', jourPasse: 'This day has passed.', termine: 'The day is over.', dispo: 'slot available', dispos: 'slots available', places: 'spots of', place: 'spot of', aideMobile: 'Tap a free slot to book, or a day to see its details.', pros: 'professionals', avec: 'With', chargement: 'Loading availability…', erreur: 'Availability unavailable right now.', dejaPasses: 'slots already past today', dejaPasse: 'slot already past today' },
  it: { titre: 'Disponibilità', semaine: 'Questa settimana', suivante: 'La prossima', prec: 'Settimana precedente', suiv: 'Settimana successiva', libre: 'Libero', partiel: 'Parzialmente preso', complet: 'Completo', passe: 'Passato', aide: 'Clicca un orario libero per prenotare.', propulse: 'Offerto da', vueSemaine: 'Settimana', vueJour: 'Giorno', matin: 'Mattina', aprem: 'Pomeriggio', ferme: 'chiuso', passeJour: 'passato', fermeJour: 'Chiuso quel giorno.', jourPasse: 'Questo giorno è passato.', termine: 'La giornata è finita.', dispo: 'orario disponibile', dispos: 'orari disponibili', places: 'posti su', place: 'posto su', aideMobile: 'Tocca un orario libero per prenotare, o un giorno per i dettagli.', pros: 'professionisti', avec: 'Con', chargement: 'Caricamento delle disponibilità…', erreur: 'Disponibilità non disponibili al momento.', dejaPasses: 'orari già passati oggi', dejaPasse: 'orario già passato oggi' },
  pt: { titre: 'Disponibilidades', semaine: 'Esta semana', suivante: 'A seguinte', prec: 'Semana anterior', suiv: 'Semana seguinte', libre: 'Livre', partiel: 'Parcialmente ocupado', complet: 'Completo', passe: 'Passado', aide: 'Clique numa vaga livre para marcar.', propulse: 'Com tecnologia', vueSemaine: 'Semana', vueJour: 'Dia', matin: 'Manhã', aprem: 'Tarde', ferme: 'fechado', passeJour: 'passado', fermeJour: 'Fechado nesse dia.', jourPasse: 'Este dia já passou.', termine: 'O dia terminou.', dispo: 'vaga disponível', dispos: 'vagas disponíveis', places: 'lugares em', place: 'lugar em', aideMobile: 'Toque numa vaga livre para marcar, ou num dia para ver o detalhe.', pros: 'profissionais', avec: 'Com', chargement: 'A carregar as disponibilidades…', erreur: 'Disponibilidades indisponíveis de momento.', dejaPasses: 'vagas já passadas hoje', dejaPasse: 'vaga já passada hoje' },
  de: { titre: 'Verfügbarkeit', semaine: 'Diese Woche', suivante: 'Nächste Woche', prec: 'Vorherige Woche', suiv: 'Nächste Woche', libre: 'Frei', partiel: 'Teilweise belegt', complet: 'Ausgebucht', passe: 'Vorbei', aide: 'Klicken Sie einen freien Termin an, um zu buchen.', propulse: 'Bereitgestellt von', vueSemaine: 'Woche', vueJour: 'Tag', matin: 'Vormittag', aprem: 'Nachmittag', ferme: 'geschlossen', passeJour: 'vorbei', fermeJour: 'An diesem Tag geschlossen.', jourPasse: 'Dieser Tag ist vorbei.', termine: 'Der Tag ist vorbei.', dispo: 'freier Termin', dispos: 'freie Termine', places: 'Plätze von', place: 'Platz von', aideMobile: 'Tippen Sie einen freien Termin an, um zu buchen, oder einen Tag für Details.', pros: 'Fachkräfte', avec: 'Mit', chargement: 'Verfügbarkeit wird geladen…', erreur: 'Verfügbarkeit derzeit nicht abrufbar.', dejaPasses: 'Termine heute bereits vorbei', dejaPasse: 'Termin heute bereits vorbei' },
};
const LOCALES: Record<LangueWidget, string> = { fr: 'fr-FR', en: 'en-GB', it: 'it-IT', pt: 'pt-PT', de: 'de-DE' };

const minutes = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return (h || 0) * 60 + (m || 0); };
const dateLocale = (iso: string) => new Date(`${iso}T12:00:00`);

export interface SemaineWidgetProps {
  donnees: OccupationPayload | null;
  chargement?: boolean;
  erreur?: boolean;
  options: OptionsSemaineWidget;
  /** Semaine demandée (0 ou 1) ; le parent recharge les données. */
  semaine: number;
  onSemaine: (semaine: number) => void;
  /** Un créneau libre choisi : date « YYYY-MM-DD » et heure « HH:mm ». */
  onChoisir: (date: string, heure: string) => void;
  /** « YYYY-MM-DD » d'aujourd'hui dans le fuseau du lieu (sinon celui du navigateur). */
  aujourdhui?: string;
}

export function SemaineWidget({ donnees, chargement, erreur, options, semaine, onSemaine, onChoisir, aujourdhui }: SemaineWidgetProps) {
  const t = TEXTES[options.lang] ?? TEXTES.fr;
  const locale = LOCALES[options.lang] ?? 'fr-FR';
  const [vueMobile, setVueMobile] = useState<'semaine' | 'jour'>('semaine');
  const [jourSel, setJourSel] = useState<number | null>(null);
  const defilement = useRef<HTMLDivElement>(null);
  const jourAujourdhui = aujourdhui ?? new Date().toISOString().slice(0, 10);

  useEffect(() => { setJourSel(null); }, [semaine]);
  // Grand écran : la grille défile jusqu'à aujourd'hui si elle déborde.
  useEffect(() => {
    const zone = defilement.current;
    const cible = zone?.querySelector<HTMLElement>('[data-aujourdhui="true"]');
    if (!zone || !cible || zone.scrollWidth <= zone.clientWidth) return;
    zone.scrollTo({ left: Math.max(0, cible.offsetLeft - 60) });
  }, [donnees]);

  const jourNom = (iso: string) => new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(dateLocale(iso)).replace('.', '');
  const jourLong = (iso: string) => { const l = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'short' }).format(dateLocale(iso)); return l.charAt(0).toUpperCase() + l.slice(1); };
  const libelleEtat = (c: CaseOccupation) => c.etat === 'libre' ? t.libre : c.etat === 'partiel' ? `${c.libres} ${c.libres > 1 ? t.places : t.place} ${c.total}` : c.etat === 'complet' ? t.complet : c.etat === 'passe' ? t.passe : t.ferme;
  const categorie = (c: CaseOccupation) => c.cat ? donnees?.categories.find((x) => x.id === c.cat) ?? null : null;
  const parCategorie = Boolean(donnees && donnees.membres.length === 1);

  const jours = donnees?.jours ?? [];
  const creneaux = donnees?.creneaux ?? [];
  const libelleSemaine = jours.length
    ? `${new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(dateLocale(jours[0].date))} – ${new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(dateLocale(jours[6].date))}`
    : '';
  const idxAujourdhui = jours.findIndex((j) => j.date === jourAujourdhui);
  const jourParDefaut = idxAujourdhui >= 0 ? idxAujourdhui : Math.max(0, jours.findIndex((j) => j.ouvert && j.date >= jourAujourdhui));
  const jourMobile = jourSel ?? jourParDefaut;
  const resumeJour = (i: number) => {
    const ouverts = (jours[i]?.cases ?? []).filter((c) => c.etat !== 'ferme' && c.etat !== 'passe');
    const libres = ouverts.filter((c) => c.etat === 'libre' || c.etat === 'partiel').length;
    return { ouverts: ouverts.length, libres, taux: ouverts.length ? 1 - libres / ouverts.length : 0 };
  };
  const sousTitre = donnees ? (donnees.membreFixe ? `${t.avec} ${donnees.membres[0]?.name ?? ''}` : donnees.membres.length > 1 ? `${donnees.membres.length} ${t.pros}` : donnees.businessName) : '';

  return <div className={s.widget} data-theme={options.theme} style={{ '--p': options.primaire, '--r': `${options.rayon}px` } as React.CSSProperties}>
    <div className={s.barre}>
      <div className={s.titre}><Calendar size={18} /><div><strong>{t.titre}</strong><span>{sousTitre}</span></div></div>
      <div className={s.nav}>
        <button type="button" onClick={() => onSemaine(0)} aria-pressed={semaine === 0}>{t.semaine}</button>
        <button type="button" onClick={() => onSemaine(1)} aria-pressed={semaine === 1}>{t.suivante}</button>
        <span>{libelleSemaine}</span>
        <button type="button" className={s.fleche} onClick={() => onSemaine(0)} disabled={semaine === 0} aria-label={t.prec}><ArrowLeft size={16} /></button>
        <button type="button" className={s.fleche} onClick={() => onSemaine(1)} disabled={semaine === 1} aria-label={t.suiv}><ArrowRight size={16} /></button>
      </div>
    </div>

    {erreur && <p className={s.etat}>{t.erreur}</p>}
    {!erreur && !donnees && <p className={s.etat}>{t.chargement}</p>}

    {donnees && <div data-chargement={chargement ? 'true' : undefined} className={s.corps}>
      {/* Téléphone */}
      <div className={s.mobile}>
        <div className={s.mobileBascule} role="group">
          <button type="button" aria-pressed={vueMobile === 'semaine'} onClick={() => setVueMobile('semaine')}>{t.vueSemaine}</button>
          <button type="button" aria-pressed={vueMobile === 'jour'} onClick={() => setVueMobile('jour')}>{t.vueJour}</button>
        </div>
        {vueMobile === 'semaine' && <div className={s.mobileSemaine}>
          <div className={s.mobileGrille} style={{ gridTemplateColumns: '2.6rem repeat(7, minmax(0, 1fr))' }} data-pas={donnees.pas}>
            <div />
            {jours.map((j, c) => <button type="button" key={j.date} className={s.mobileJourTete} data-aujourdhui={j.date === jourAujourdhui} data-ferme={!j.ouvert || j.date < jourAujourdhui} onClick={() => { setJourSel(c); setVueMobile('jour'); }}><span>{jourNom(j.date)}</span><strong>{dateLocale(j.date).getDate()}</strong></button>)}
            {creneaux.map((h, r) => <div key={h} style={{ display: 'contents' }}>
              <div className={s.mobileHeure}>{minutes(h) % 60 === 0 ? h : ''}</div>
              {jours.map((j) => { const cel = j.cases[r]; const cat = categorie(cel); const cliquable = cel.etat === 'libre' || cel.etat === 'partiel';
                return <button type="button" key={j.date} className={s.mobileCase} data-etat={cel.etat} disabled={!cliquable} onClick={() => onChoisir(j.date, h)} style={parCategorie && cat ? { '--cat': cat.color } as React.CSSProperties : undefined} aria-label={`${jourLong(j.date)} ${h} : ${libelleEtat(cel)}`} />; })}
            </div>)}
          </div>
          <p className={s.mobileAide}>{t.aideMobile}</p>
        </div>}
        {vueMobile === 'jour' && <div className={s.jourBande} role="tablist">
          {jours.map((j, c) => { const r = resumeJour(c); const passe = j.date < jourAujourdhui; return <button type="button" role="tab" key={j.date} aria-selected={jourMobile === c} data-aujourdhui={j.date === jourAujourdhui} data-ferme={!j.ouvert || passe} onClick={() => setJourSel(c)}>
            <span>{jourNom(j.date)}</span><strong>{dateLocale(j.date).getDate()}</strong>
            {j.ouvert && !passe ? <i aria-hidden="true"><b style={{ width: `${Math.round(r.taux * 100)}%` }} /></i> : <em>{passe ? t.passeJour : t.ferme}</em>}
          </button>; })}
        </div>}
        {vueMobile === 'jour' && jours[jourMobile] && (() => {
          const j = jours[jourMobile]; const r = resumeJour(jourMobile);
          const toutes = j.cases.map((cel, i) => ({ cel, h: creneaux[i] })).filter((x) => x.cel.etat !== 'ferme');
          const passees = toutes.filter((x) => x.cel.etat === 'passe').length;
          const lignes = toutes.filter((x) => x.cel.etat !== 'passe');
          if (!toutes.length) return <p className={s.mobileVide}>{j.date < jourAujourdhui ? t.jourPasse : t.fermeJour}</p>;
          if (!lignes.length) return <p className={s.mobileVide}>{t.termine}</p>;
          const matin = lignes.filter((x) => minutes(x.h) < 13 * 60), aprem = lignes.filter((x) => minutes(x.h) >= 13 * 60);
          return <div className={s.mobileJour}>
            <p className={s.mobileTitre}><strong>{jourLong(j.date)}</strong><span>{r.ouverts ? `${r.libres} ${r.libres > 1 ? t.dispos : t.dispo}` : ''}</span></p>
            {passees > 0 && <p className={s.mobilePasse}>{passees} {passees > 1 ? t.dejaPasses : t.dejaPasse}</p>}
            {([[t.matin, matin], [t.aprem, aprem]] as const).map(([titre, groupe]) => groupe.length ? <div key={titre} className={s.mobileGroupe}>
              <h4>{titre}</h4>
              {groupe.map(({ cel, h }) => { const cat = categorie(cel); const cliquable = cel.etat === 'libre' || cel.etat === 'partiel';
                return <button type="button" key={h} className={s.mobileLigne} data-etat={cel.etat} disabled={!cliquable} onClick={() => onChoisir(j.date, h)} style={parCategorie && cat ? { '--cat': cat.color } as React.CSSProperties : undefined}>
                  <time>{h}</time><span>{parCategorie && cat ? cat.label : libelleEtat(cel)}</span>{cliquable && <ArrowRight size={16} />}
                </button>; })}
            </div> : null)}
          </div>;
        })()}
      </div>

      {/* Grand écran */}
      <div className={`${s.defilement} ${s.bureau}`} ref={defilement}>
        <div className={s.grille} style={{ gridTemplateColumns: '3.4rem repeat(7, minmax(4.6rem, 1fr))' }}>
          <div />
          {jours.map((j) => <div key={j.date} className={s.jour} data-aujourdhui={j.date === jourAujourdhui} data-ferme={!j.ouvert}><span>{jourNom(j.date)}</span><strong>{dateLocale(j.date).getDate()}</strong></div>)}
          {creneaux.map((h, r) => <div key={h} style={{ display: 'contents' }}>
            <div className={s.heure}>{minutes(h) % 60 === 0 ? h : ''}</div>
            {jours.map((j) => { const cel = j.cases[r]; const cat = categorie(cel); const cliquable = cel.etat === 'libre' || cel.etat === 'partiel';
              return <button type="button" key={j.date} className={s.cellule} data-etat={cel.etat} data-aujourdhui={j.date === jourAujourdhui} disabled={!cliquable} onClick={() => onChoisir(j.date, h)} style={parCategorie && cat ? { '--cat': cat.color } as React.CSSProperties : undefined} aria-label={`${jourLong(j.date)} ${h} : ${libelleEtat(cel)}`}>
                {cel.etat === 'partiel' && <span>{cel.libres}/{cel.total}</span>}
              </button>; })}
          </div>)}
        </div>
      </div>

      {options.legende && <div className={s.legende}>
        <span><i data-etat="libre" /> {t.libre}</span>
        {!parCategorie && <span><i data-etat="partiel" /> {t.partiel}</span>}
        {parCategorie && donnees.categories.length
          ? donnees.categories.map((c) => <span key={c.id}><i style={{ background: c.color }} /> {c.label}</span>)
          : <span><i data-etat="complet" /> {t.complet}</span>}
        <span><i data-etat="passe" /> {t.passe}</span>
      </div>}
      <div className={s.pied}><span>{t.aide}</span><span>{t.propulse} <b>Opatam</b></span></div>
    </div>}
  </div>;
}
