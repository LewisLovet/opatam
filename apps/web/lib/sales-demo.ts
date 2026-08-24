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

const serviceSchema = z.object({
  name: z.string().min(1, 'nom de prestation manquant').max(100),
  description: z.string().max(300).optional().default(''),
  price: prixEuros,
  duration: dureeMinutes.optional().default(60),
  variations: z.array(variationSchema).max(3).optional(),
});

export const demoConfigSchema = z.object({
  businessName: z.string().min(1, 'nom de l’établissement manquant').max(100),
  description: z.string().max(500).optional().default(''),
  city: z.string().max(60).optional().default(''),
  sector: z.string().max(40).optional().default('beaute'),
  /** Identifiant du catalogue de thèmes — validé à la construction de page,
   *  repli sur le thème par défaut si inconnu. */
  themeId: z.string().max(30).optional(),
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
          ]
        }
      ]
    }
  ]
}

Règles impératives :
- "price" en EUROS, nombre sans symbole (45.50 et non "45,50 €").
- "duration" en MINUTES, nombre entier. Si la durée n'apparaît pas, estime-la raisonnablement selon la prestation.
- N'INVENTE AUCUNE prestation ni aucun prix : ne reprends que ce qui figure sur le document. Une mention illisible s'omet.
- "variations" seulement si le document montre plusieurs prix pour une même prestation (par longueur, par zone…) ; sinon omets le champ.
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
        }),
      ),
    }),
  ),
});
