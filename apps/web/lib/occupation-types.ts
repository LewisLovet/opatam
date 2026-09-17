/**
 * Widget « vue semaine » — le contrat entre le calcul serveur, la page
 * embarquée et la démonstration. Aucune donnée personnelle : des cases
 * libres / partielles / complètes, et au plus la couleur d'une prestation.
 */

export type EtatCase = 'ferme' | 'passe' | 'libre' | 'partiel' | 'complet';

export interface CaseOccupation {
  etat: EtatCase;
  /** Membres encore libres sur ce créneau (0 si complet, passé ou fermé). */
  libres: number;
  /** Membres ouverts sur ce créneau. */
  total: number;
  /** Identifiant de catégorie (voir `categories`) — seulement en vue solo ou membre fixé, case complète. */
  cat: string | null;
}

export interface JourOccupation {
  /** « YYYY-MM-DD » dans le fuseau du lieu. */
  date: string;
  /** Au moins un membre ouvert ce jour-là. */
  ouvert: boolean;
  /** Une case par créneau de `creneaux`, dans le même ordre. */
  cases: CaseOccupation[];
}

export interface CategorieOccupation {
  id: string;
  label: string;
  color: string;
}

export interface OccupationPayload {
  slug: string;
  businessName: string;
  themeId: string | null;
  /** Membres pris en compte (un seul en solo ou membre fixé). */
  membres: { id: string; name: string }[];
  membreFixe: string | null;
  /** 0 = semaine courante, 1 = la suivante. */
  semaine: number;
  /** Lundi de la semaine, « YYYY-MM-DD ». */
  lundi: string;
  /** Pas de la grille, en minutes (30 ou 60). */
  pas: number;
  /** « HH:mm » de chaque ligne de la grille. */
  creneaux: string[];
  /** Sept jours, du lundi au dimanche. */
  jours: JourOccupation[];
  /** Légende des couleurs (vide en vue équipe). */
  categories: CategorieOccupation[];
  /** Instant du calcul, ISO. */
  genereLe: string;
}
