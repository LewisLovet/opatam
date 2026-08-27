import { z } from 'zod';
import { SALES_STAGES, SALES_LOSS_REASONS, SALES_SECTORS } from '@booking-app/shared';

/**
 * Prospects (pipeline commercial) — la frontière de validation.
 *
 * Tout passe par les routes requireStaff : la collection est fermée au SDK
 * client. Les champs texte sont bornés court — une fiche prospect est un
 * outil de travail, pas un dossier.
 */

const texteCourt = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional();

export const leadCreateSchema = z.object({
  businessName: z.string().trim().min(1, "nom de l'établissement requis").max(120),
  contactName: texteCourt(80),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('e-mail invalide')
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
  phone: texteCourt(30),
  city: texteCourt(80),
  sector: z.enum(SALES_SECTORS).optional().default('beaute'),
  isTeam: z.boolean().optional().default(false),
  source: texteCourt(120),
  mainPain: texteCourt(200),
  currentPlatform: texteCourt(60),
  profileUrl: texteCourt(300),
  /** Ce que le prospect paie AUJOURD'HUI (€/mois, son devis réel) — la
   *  matière première de la comparaison chiffrée en mode rendez-vous. */
  currentPriceEuros: z.number().min(0).max(2000).nullable().optional(),
  notes: texteCourt(2000),
  stage: z.enum(SALES_STAGES).optional().default('prospect'),
  /** ISO — date du prochain contact prévu. */
  nextActionAt: z.string().datetime().nullable().optional(),
});

export const leadUpdateSchema = leadCreateSchema.partial().extend({
  lostReason: z.enum(SALES_LOSS_REASONS).nullable().optional(),
  optOut: z.boolean().optional(),
});

export type LeadCreateInput = z.infer<typeof leadCreateSchema>;
export type LeadUpdateInput = z.infer<typeof leadUpdateSchema>;

export const activityCreateSchema = z.object({
  leadId: z.string().min(1),
  type: z.enum(['note', 'appel', 'email', 'demo']),
  body: z.string().trim().min(1, 'note vide').max(2000),
});

/** Libellés du tunnel, côté interface. */
export const STAGE_LABELS: Record<(typeof SALES_STAGES)[number], string> = {
  prospect: 'À contacter',
  contacte: 'Contacté',
  reponse: 'A répondu',
  qualifie: 'Qualifié',
  demo_planifiee: 'Démo planifiée',
  demo_realisee: 'Démo faite',
  essai_cree: 'Compte créé',
  essai_active: 'Compte activé',
  payant: 'Abonné payant',
  conserve_j90: 'Conservé 90 j',
};

export const LOSS_LABELS: Record<(typeof SALES_LOSS_REASONS)[number], string> = {
  pas_de_reponse: 'Pas de réponse',
  pas_interesse: 'Pas intéressé',
  prix: 'Prix',
  concurrent: 'Parti chez un concurrent',
  pas_le_bon_moment: 'Pas le bon moment',
  hors_cible: 'Hors cible',
  autre: 'Autre',
};

export const SECTOR_LABELS: Record<(typeof SALES_SECTORS)[number], string> = {
  coiffure: 'Coiffure',
  barbier: 'Barbier',
  onglerie: 'Onglerie',
  esthetique: 'Esthétique',
  cils_sourcils: 'Cils & sourcils',
  maquillage: 'Maquillage',
  massage: 'Massage',
  spa: 'Spa & bien-être',
  tatouage: 'Tatouage',
  beaute: 'Beauté (général)',
  bien_etre: 'Bien-être',
  sport: 'Sport & coaching',
  formation: 'Formation & cours',
  studio: 'Studio / créatif',
  autre: 'Autre',
};

/** Sources de prospection proposées — « Autre… » ouvre un champ libre. */
export const SOURCES_PROSPECTION = [
  'Prospection terrain',
  'Salon / événement',
  'Instagram',
  'TikTok',
  'Recommandation client',
  'Appel entrant',
  'Site web',
] as const;

/** Outils concurrents proposés — « Autre… » ouvre un champ libre. */
export const PLATFORM_LABELS: Record<string, string> = {
  planity: 'Planity',
  treatwell: 'Treatwell',
  fresha: 'Fresha',
  kiute: 'Kiute',
  wavy: 'Wavy',
  booksy: 'Booksy',
  iara_beauty: 'Iara Beauty',
  instagram_dm: 'Instagram / DM uniquement',
  papier_telephone: 'Papier / téléphone',
  aucun: 'Aucun outil',
};
