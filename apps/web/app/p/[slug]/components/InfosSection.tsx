'use client';

import { useTranslations } from 'next-intl';
import { MapPin, Clock, Info } from 'lucide-react';
import { LocationCard } from './LocationCard';
import { HoursCard } from './HoursCard';
import { TeamSection } from './TeamSection';

interface Location {
  id: string;
  name: string;
  address: string;
  city: string;
  postalCode: string;
  type: 'fixed' | 'mobile';
  travelRadius: number | null;
}

interface Member {
  id: string;
  name: string;
  photoURL: string | null;
  locationId: string;
}

interface Availability {
  memberId: string;
  /** Dénormalisé depuis le membre. Ce type local l'OMETTAIT, alors que la
   *  page le sérialise et que la base le porte : le champ arrivait bien à
   *  l'exécution, mais TypeScript prétendait qu'il n'existait pas. */
  locationId: string;
  dayOfWeek: number;
  slots: { start: string; end: string }[];
  isOpen: boolean;
}

interface InfosSectionProps {
  locations: Location[];
  members: Member[];
  availabilities: Availability[];
  isTeam: boolean;
}

/** « 09:30 » → 570. */
function enMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Une fin à « 00:00 » désigne minuit de FIN de journée, pas le début. */
function finEnMinutes(hhmm: string): number {
  const m = enMinutes(hhmm);
  return m === 0 ? 24 * 60 : m;
}

const enHhmm = (minutes: number): string =>
  `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/**
 * Réunit les plages de plusieurs agendas en une seule lecture.
 *
 * Un lieu peut compter plusieurs professionnels aux horaires décalés. Pour la
 * cliente, le lieu est ouvert dès que QUELQU'UN y travaille : c'est donc bien
 * l'union qu'il faut montrer, pas l'agenda de l'un d'eux.
 */
function fusionnerPlages(plages: { start: string; end: string }[]): { start: string; end: string }[] {
  const bornes = plages
    .map((p) => ({ debut: enMinutes(p.start), fin: finEnMinutes(p.end) }))
    .filter((p) => p.fin > p.debut)
    .sort((a, b) => a.debut - b.debut);

  const sortie: { debut: number; fin: number }[] = [];
  for (const p of bornes) {
    const derniere = sortie[sortie.length - 1];
    if (derniere && p.debut <= derniere.fin) {
      derniere.fin = Math.max(derniere.fin, p.fin);
    } else {
      sortie.push({ ...p });
    }
  }
  return sortie.map((p) => ({ start: enHhmm(p.debut), end: enHhmm(p.fin) }));
}

export function InfosSection({ locations, members, availabilities, isTeam }: InfosSectionProps) {
  const t = useTranslations('provider');
  // Localized day names, Sunday-first (indexable by JS getDay()).
  const dayNames = t.raw('infos.days') as string[];

  /**
   * La semaine d'un lieu, réunie depuis les agendas des membres qui y
   * travaillent.
   *
   * Ce bloc n'affichait que l'agenda d'UN membre — « Principal », ou le
   * premier de la liste — pendant qu'il listait TOUS les lieux au-dessus. Un
   * prestataire à deux adresses voyait donc deux adresses et une seule plage
   * horaire, celle d'un membre qui ne travaille peut-être même pas là. Et en
   * solo à plusieurs membres, les horaires des autres disparaissaient
   * purement et simplement.
   */
  const semainePourAgendas = (agendas: Availability[]) =>
    [1, 2, 3, 4, 5, 6, 0].map((dayOfWeek) => {
      const duJour = agendas.filter((a) => a.dayOfWeek === dayOfWeek && a.isOpen);
      const slots = fusionnerPlages(duJour.flatMap((a) => a.slots ?? []));
      return { day: dayNames[dayOfWeek], isOpen: slots.length > 0, slots };
    });

  /**
   * Le lieu d'un agenda vient du document lui-même, où il est dénormalisé, et
   * non du membre : si un professionnel change de rattachement, l'agenda
   * garde le lieu pour lequel il a été saisi.
   */
  const lieuDeLAgenda = (a: Availability) =>
    a.locationId || members.find((m) => m.id === a.memberId)?.locationId || '';

  /**
   * Les lieux qui ont RÉELLEMENT des horaires.
   *
   * Un agenda appartient à un membre, et un membre à un seul lieu : un
   * prestataire à deux adresses mais un seul professionnel n'a donc qu'un
   * agenda, pour l'adresse où ce professionnel travaille. Le second lieu
   * n'est pas « fermé », il n'a simplement rien de saisi — et afficher une
   * semaine entière de « Fermé » sous son nom annoncerait une fermeture que
   * personne n'a déclarée. On ne montre d'horaires que là où il y en a.
   */
  const lieuxAvecHoraires = locations
    .map((lieu) => ({
      lieu,
      semaine: semainePourAgendas(availabilities.filter((a) => lieuDeLAgenda(a) === lieu.id)),
    }))
    .filter(({ semaine }) => semaine.some((j) => j.isOpen));

  // Filet : agendas rattachés à aucun lieu connu, ou aucun lieu déclaré.
  const semaineGlobale = semainePourAgendas(availabilities);

  return (
    <section className="py-10 border-t border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-2 mb-6">
        <Info className="w-6 h-6 text-primary-500" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t('infos.title')}
        </h2>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Locations Column */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary-500" />
            {t('infos.locationTitle', { count: locations.length })}
            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-sm rounded-full">
              {locations.length}
            </span>
          </h3>
          <div className="space-y-4">
            {locations.map((location) => (
              <LocationCard key={location.id} location={location} />
            ))}
          </div>
        </div>

        {/* Hours Column */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary-500" />
            {t('infos.openingHours')}
          </h3>
          {/* Le nom du lieu ne coiffe les horaires que s'il y a VRAIMENT
              plusieurs semaines distinctes à distinguer. Avec une seule, le
              sous-titre laisserait croire que les autres adresses ont leurs
              propres horaires ailleurs sur la page. */}
          {lieuxAvecHoraires.length > 1 ? (
            <div className="space-y-5">
              {lieuxAvecHoraires.map(({ lieu, semaine }) => (
                <div key={lieu.id}>
                  <p className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {lieu.name}
                  </p>
                  <HoursCard weekSchedule={semaine} />
                </div>
              ))}
            </div>
          ) : (
            <HoursCard
              weekSchedule={lieuxAvecHoraires[0]?.semaine ?? semaineGlobale}
            />
          )}
        </div>
      </div>

      {/* Team Section */}
      {isTeam && members.length > 1 && (
        <div className="mt-10">
          <TeamSection members={members} />
        </div>
      )}
    </section>
  );
}
