/**
 * Langue et libellés des notifications PUSH envoyées au prestataire.
 *
 * POURQUOI CE MODULE. Tout ce qui part vers le prestataire — push comme
 * e-mails — était écrit en français en dur, alors que l'application est
 * servie en cinq langues. Un salon portugais recevait « Vous avez 3
 * rendez-vous » ; désormais il reçoit « Tem 3 marcações ».
 *
 * D'OÙ VIENT LA LANGUE. Aucun champ ne la porte aujourd'hui : ni `user`, ni
 * `provider`. On la déduit donc du PAYS du prestataire, qui lui vient de son
 * lieu et reflète la réalité — la même source que le fuseau horaire, pour la
 * même raison.
 *
 * C'est une déduction, pas une préférence : un salon portugais tenu par un
 * francophone recevra du portugais. Le champ `provider.locale` est donc lu en
 * priorité s'il existe, pour qu'une préférence explicite — le jour où
 * l'application l'enregistrera — prenne le pas sans retoucher ce module.
 */

export type ProviderLocale = 'fr' | 'en' | 'it' | 'pt' | 'de';

const SUPPORTED: readonly ProviderLocale[] = ['fr', 'en', 'it', 'pt', 'de'];

/**
 * Langue déduite du pays. L'espagnol et le néerlandais ne font pas partie des
 * cinq langues servies : l'anglais y est un repli plus utile que le français.
 */
const COUNTRY_LOCALES: Record<string, ProviderLocale> = {
  FR: 'fr', BE: 'fr', LU: 'fr', CH: 'fr',
  DE: 'de',
  IT: 'it',
  PT: 'pt',
  ES: 'en', NL: 'en',
};

export function providerLocale(provider: {
  locale?: string | null;
  countryCode?: string | null;
}): ProviderLocale {
  const explicite = provider.locale as ProviderLocale | undefined;
  if (explicite && SUPPORTED.includes(explicite)) return explicite;
  return COUNTRY_LOCALES[(provider.countryCode ?? '').toUpperCase()] ?? 'fr';
}

/** Étiquette Intl pour les dates et heures. */
export const INTL_LOCALE: Record<ProviderLocale, string> = {
  fr: 'fr-FR', en: 'en-GB', it: 'it-IT', pt: 'pt-PT', de: 'de-DE',
};

type Textes = {
  nouveauRdv: string;
  nouveauRdvAcompte: string;
  /** `{montant}` encaissé — suffixe ajouté au corps. */
  acompteEncaisse: (montant: string) => string;
  journee: string;
  journeeUn: (heure: string) => string;
  journeePlusieurs: (n: number, heure: string) => string;
  rdvDansUneHeure: string;
  rdvDansNMinutes: (n: number) => string;
  rdvAnnule: string;
  annuleParClient: (nom: string, date: string) => string;
  prestationAjoutee: string;
  prestationRetiree: string;
  uneCliente: string;
  /** « Nom · Prestation le date » — même forme partout. */
  ligneRdv: (nom: string, prestation: string, date: string) => string;
};

export const PUSH_TEXTS: Record<ProviderLocale, Textes> = {
  fr: {
    nouveauRdv: 'Nouveau rendez-vous',
    nouveauRdvAcompte: 'Nouveau RDV avec acompte',
    acompteEncaisse: (m) => `${m} encaissés`,
    journee: "Votre journée d'aujourd'hui",
    journeeUn: (h) => `Vous avez 1 rendez-vous, à ${h}.`,
    journeePlusieurs: (n, h) => `Vous avez ${n} rendez-vous. Le premier commence à ${h}.`,
    rdvDansUneHeure: 'Rendez-vous dans 1 heure',
    rdvDansNMinutes: (n) => `Rendez-vous dans ${n} minutes`,
    rdvAnnule: 'Rendez-vous annulé',
    annuleParClient: (nom, d) => `${nom} a annulé son RDV du ${d}`,
    prestationAjoutee: 'Prestation ajoutée',
    prestationRetiree: 'Prestation retirée',
    uneCliente: 'Une cliente',
    ligneRdv: (nom, p, d) => `${nom} · ${p} le ${d}`,
  },
  en: {
    nouveauRdv: 'New booking',
    nouveauRdvAcompte: 'New booking with deposit',
    acompteEncaisse: (m) => `${m} collected`,
    journee: 'Your day today',
    journeeUn: (h) => `You have 1 booking, at ${h}.`,
    journeePlusieurs: (n, h) => `You have ${n} bookings. The first one starts at ${h}.`,
    rdvDansUneHeure: 'Booking in 1 hour',
    rdvDansNMinutes: (n) => `Booking in ${n} minutes`,
    rdvAnnule: 'Booking cancelled',
    annuleParClient: (nom, d) => `${nom} cancelled their booking on ${d}`,
    prestationAjoutee: 'Service added',
    prestationRetiree: 'Service removed',
    uneCliente: 'A client',
    ligneRdv: (nom, p, d) => `${nom} · ${p} on ${d}`,
  },
  it: {
    nouveauRdv: 'Nuovo appuntamento',
    nouveauRdvAcompte: 'Nuovo appuntamento con acconto',
    acompteEncaisse: (m) => `${m} incassati`,
    journee: 'La tua giornata di oggi',
    journeeUn: (h) => `Hai 1 appuntamento, alle ${h}.`,
    journeePlusieurs: (n, h) => `Hai ${n} appuntamenti. Il primo inizia alle ${h}.`,
    rdvDansUneHeure: 'Appuntamento tra 1 ora',
    rdvDansNMinutes: (n) => `Appuntamento tra ${n} minuti`,
    rdvAnnule: 'Appuntamento annullato',
    annuleParClient: (nom, d) => `${nom} ha annullato l'appuntamento del ${d}`,
    prestationAjoutee: 'Servizio aggiunto',
    prestationRetiree: 'Servizio rimosso',
    uneCliente: 'Una cliente',
    ligneRdv: (nom, p, d) => `${nom} · ${p} il ${d}`,
  },
  pt: {
    nouveauRdv: 'Nova marcação',
    nouveauRdvAcompte: 'Nova marcação com sinal',
    acompteEncaisse: (m) => `${m} recebidos`,
    journee: 'O seu dia de hoje',
    journeeUn: (h) => `Tem 1 marcação, às ${h}.`,
    journeePlusieurs: (n, h) => `Tem ${n} marcações. A primeira começa às ${h}.`,
    rdvDansUneHeure: 'Marcação daqui a 1 hora',
    rdvDansNMinutes: (n) => `Marcação daqui a ${n} minutos`,
    rdvAnnule: 'Marcação cancelada',
    annuleParClient: (nom, d) => `${nom} cancelou a marcação de ${d}`,
    prestationAjoutee: 'Serviço adicionado',
    prestationRetiree: 'Serviço removido',
    uneCliente: 'Uma cliente',
    ligneRdv: (nom, p, d) => `${nom} · ${p} a ${d}`,
  },
  de: {
    nouveauRdv: 'Neuer Termin',
    nouveauRdvAcompte: 'Neuer Termin mit Anzahlung',
    acompteEncaisse: (m) => `${m} erhalten`,
    journee: 'Ihr heutiger Tag',
    journeeUn: (h) => `Sie haben 1 Termin, um ${h}.`,
    journeePlusieurs: (n, h) => `Sie haben ${n} Termine. Der erste beginnt um ${h}.`,
    rdvDansUneHeure: 'Termin in 1 Stunde',
    rdvDansNMinutes: (n) => `Termin in ${n} Minuten`,
    rdvAnnule: 'Termin abgesagt',
    annuleParClient: (nom, d) => `${nom} hat den Termin am ${d} abgesagt`,
    prestationAjoutee: 'Leistung hinzugefügt',
    prestationRetiree: 'Leistung entfernt',
    uneCliente: 'Eine Kundin',
    ligneRdv: (nom, p, d) => `${nom} · ${p} am ${d}`,
  },
};
