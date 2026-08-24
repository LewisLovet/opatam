import { z } from 'zod';

/**
 * Démo personnalisée — le prospect voit SA page Opatam avant de s'inscrire.
 *
 * Le commercial photographie la carte de prestations du prospect (PDF, Canva,
 * vitrine), la donne à l'IA de son choix avec LE prompt ci-dessous, colle le
 * JSON obtenu dans /sales/demo, et obtient une page /p/demo-<id> complète —
 * vitrine ET tunnel de réservation testable (mode isDemo : rien n'est écrit).
 *
 * PARTI PRIS v1 : pas d'appel d'IA intégré. Le prompt copié marche avec
 * n'importe quel modèle, sans clé ni quota. La validation zod ci-dessous est
 * la vraie frontière : tout ce que l'IA renvoie est traité comme une saisie
 * non fiable — enrobage markdown retiré, prix en euros convertis en centimes,
 * erreurs expliquées champ par champ en français.
 */

// ── Schéma du JSON attendu ───────────────────────────────────────────────────

/** Prix : l'IA écrit des euros (« 45 » ou « 45.5 ») — convertis en centimes. */
const prixEuros = z.coerce
  .number({ message: 'doit être un nombre (en euros)' })
  .min(0, 'un prix ne peut pas être négatif')
  .max(10_000, 'prix invraisemblable (max 10 000 €)')
  .transform((e) => Math.round(e * 100));

const dureeMinutes = z.coerce
  .number({ message: 'doit être un nombre (en minutes)' })
  .int('doit être un nombre entier de minutes')
  .min(5, 'durée minimale : 5 minutes')
  .max(600, 'durée maximale : 10 heures');

const variationSchema = z.object({
  name: z.string().min(1).max(80),
  options: z
    .array(
      z.object({
        name: z.string().min(1).max(80),
        price: prixEuros,
        duration: dureeMinutes.optional(),
      }),
    )
    .min(2, 'une variation doit proposer au moins 2 choix')
    .max(8),
});

/** Supplément facultatif : prix et minutes AJOUTÉS quand il est coché. */
const supplementSchema = z.object({
  name: z.string().min(1).max(80),
  price: prixEuros,
  duration: dureeMinutes.optional(),
});

const serviceSchema = z.object({
  name: z.string().min(1, 'nom de prestation manquant').max(100),
  description: z.string().max(300).optional().default(''),
  price: prixEuros,
  duration: dureeMinutes.optional().default(60),
  variations: z.array(variationSchema).max(3).optional(),
  options: z.array(supplementSchema).max(6).optional(),
});

export const demoConfigSchema = z.object({
  businessName: z.string().min(1, 'nom de l’établissement manquant').max(100),
  description: z.string().max(500).optional().default(''),
  city: z.string().max(60).optional().default(''),
  sector: z.string().max(40).optional().default('beaute'),
  /** Identifiant du catalogue de thèmes — validé à la construction de page,
   *  repli sur le thème par défaut si inconnu. Prime sur brandColor. */
  themeId: z.string().max(30).optional(),
  /** Couleur dominante de l'identité visuelle du document (hex). Sert à
   *  choisir automatiquement le thème Opatam le plus proche. */
  brandColor: z
    .string()
    .regex(/^#?[0-9a-fA-F]{6}$/, 'couleur attendue au format hex #RRGGBB')
    .transform((c) => (c.startsWith('#') ? c : `#${c}`))
    .optional(),
  categories: z
    .array(
      z.object({
        name: z.string().min(1, 'nom de catégorie manquant').max(80),
        services: z.array(serviceSchema).min(1, 'catégorie sans prestation').max(30),
      }),
    )
    .min(1, 'au moins une catégorie de prestations')
    .max(12),
});

export type DemoConfig = z.infer<typeof demoConfigSchema>;

// ── Normalisation du collage IA ──────────────────────────────────────────────

/**
 * Rend exploitable ce que le commercial colle : les IA enrobent le JSON de
 * ```json …```, de phrases d'introduction ou de virgules terminales.
 */
export function extraireJson(colle: string): string {
  let s = colle.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) s = fence[1].trim();
  // Coupe tout ce qui précède la première accolade et suit la dernière.
  const debut = s.indexOf('{');
  const fin = s.lastIndexOf('}');
  if (debut >= 0 && fin > debut) s = s.slice(debut, fin + 1);
  return s;
}

export type DemoParseResult =
  | { ok: true; config: DemoConfig }
  | { ok: false; erreurs: string[] };

export function parseDemoConfig(colle: string): DemoParseResult {
  let brut: unknown;
  try {
    brut = JSON.parse(extraireJson(colle));
  } catch {
    return {
      ok: false,
      erreurs: [
        "Le texte collé n'est pas du JSON valide. Recopiez la réponse complète de l'IA, de la première accolade { à la dernière }.",
      ],
    };
  }
  const res = demoConfigSchema.safeParse(brut);
  if (res.success) return { ok: true, config: res.data };
  return {
    ok: false,
    erreurs: res.error.issues.slice(0, 8).map((i) => {
      const chemin = i.path
        .map((p) => (typeof p === 'number' ? `n°${p + 1}` : String(p)))
        .join(' → ')
        .replace('categories', 'catégorie')
        .replace('services', 'prestation')
        .replace('variations', 'variation')
        .replace('options', 'choix');
      return chemin ? `${chemin} : ${i.message}` : i.message;
    }),
  };
}

// ── Le prompt à copier ───────────────────────────────────────────────────────

/**
 * Figé et versionné : chaque commercial colle LE MÊME prompt, la sortie a
 * toujours la même forme, et la validation ci-dessus fait le reste.
 */
export const DEMO_PROMPT = `Tu es un assistant qui extrait la carte des prestations d'un salon (photo, PDF ou capture de menu) vers un format JSON strict.

À partir du document fourni, renvoie UNIQUEMENT un objet JSON — aucune phrase avant ou après, pas de bloc de code — exactement de cette forme :

{
  "businessName": "Nom de l'établissement",
  "description": "Une phrase de présentation si visible, sinon vide",
  "city": "Ville si visible, sinon vide",
  "sector": "coiffure",
  "brandColor": "#7c3aed",
  "categories": [
    {
      "name": "Nom de la catégorie (ex : Coupes, Soins, Couleur)",
      "services": [
        {
          "name": "Nom de la prestation",
          "description": "Détail si présent, sinon vide",
          "price": 45,
          "duration": 60,
          "variations": [
            {
              "name": "Nom du critère (ex : Longueur des cheveux)",
              "options": [
                { "name": "Cheveux courts", "price": 45, "duration": 45 },
                { "name": "Cheveux longs", "price": 55, "duration": 60 }
              ]
            }
          ],
          "options": [
            { "name": "Soin profond en supplément", "price": 10, "duration": 15 }
          ]
        }
      ]
    }
  ]
}

Champs généraux :
- "sector" : choisis LA valeur la plus proche dans cette liste exacte : coiffure, barbier, ongles, esthetique, maquillage, massage, tatouage, autre.
- "brandColor" : la couleur dominante de l'IDENTITÉ VISUELLE du document — fond, titres, logo — au format "#RRGGBB". Si le document est simplement noir sur blanc, sans couleur marquée, omets ce champ. Ignore les couleurs des photos.

Prix et durées :
- "price" en EUROS, nombre sans symbole (45.50 et non "45,50 €").
- "duration" en MINUTES, nombre entier. Si la durée n'apparaît pas, estime-la raisonnablement selon la prestation.

Comment trier — prestation, variation ou supplément :
- VARIATION ("variations") : le MÊME acte dont le prix dépend d'une caractéristique de la cliente (longueur de cheveux, taille de la zone, densité). Les prix des choix sont des prix COMPLETS, pas des ajouts. Exemple : « Lissage : courts 35 €, longs 45 € » → une prestation "Lissage" avec une variation "Longueur des cheveux" à deux choix.
- Plusieurs LIGNES du document qui déclinent le même acte (« Box braids courtes 70 € » puis « Box braids longues 90 € ») → UNE SEULE prestation "Box braids" avec une variation "Longueur", jamais deux prestations. Le "price" de la prestation est alors celui du choix le moins cher.
- SUPPLÉMENT ("options" au niveau de la prestation) : un ajout facultatif signalé par « + », « en option » ou « en supplément » (« + soin profond 10 € »). Son "price" est le montant AJOUTÉ au prix de la prestation, sa "duration" les minutes AJOUTÉES (omets "duration" si rien n'est indiqué : un supplément sans durée n'allonge pas le rendez-vous). Un supplément n'est JAMAIS une prestation à part ni une variation.
- PRESTATIONS SÉPARÉES : des actes ou des zones différents que la cliente réserve indépendamment restent des prestations distinctes, même listés sur la même ligne (« Épilation : sourcils 8 €, jambes 20 € » → deux prestations "Épilation sourcils" et "Épilation jambes").
- En cas de doute : si les intitulés désignent le même geste sur la même zone, c'est une variation ; si le geste ou la zone change, ce sont des prestations séparées.

Règles impératives :
- N'INVENTE AUCUNE prestation ni aucun prix : ne reprends que ce qui figure sur le document. Une mention illisible s'omet.
- Si le document liste des prestations sans catégories, crée une seule catégorie "Prestations".
- Réponds en conservant la langue du document pour les noms.`;

// ── Schéma de LECTURE (document stocké) ─────────────────────────────────────

/**
 * Le document stocké porte des CENTIMES : la transformation euros→centimes a
 * eu lieu à l'écriture. Re-valider avec le schéma d'écriture reconvertirait
 * une seconde fois — c'est arrivé : 80 € devenait 8 000 € à l'affichage.
 * D'où deux schémas : même forme, mais celui-ci ne transforme rien.
 */
const centimes = z.number().int().min(0).max(1_000_000);
const dureeLecture = z.number().int().min(5).max(600);

export const demoConfigStoredSchema = z.object({
  businessName: z.string(),
  description: z.string().optional().default(''),
  city: z.string().optional().default(''),
  sector: z.string().optional().default('beaute'),
  themeId: z.string().optional(),
  brandColor: z.string().optional(),
  categories: z.array(
    z.object({
      name: z.string(),
      services: z.array(
        z.object({
          name: z.string(),
          description: z.string().optional().default(''),
          price: centimes,
          duration: dureeLecture.optional().default(60),
          variations: z
            .array(
              z.object({
                name: z.string(),
                options: z.array(
                  z.object({ name: z.string(), price: centimes, duration: dureeLecture.optional() }),
                ),
              }),
            )
            .optional(),
          options: z
            .array(z.object({ name: z.string(), price: centimes, duration: dureeLecture.optional() }))
            .optional(),
        }),
      ),
    }),
  ),
});
