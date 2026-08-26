/**
 * Rate-limit mémoire par IP — un AMORTISSEUR d'abus, pas une garantie :
 * chaque instance Vercel a sa propre Map (et un cold start la vide). La
 * protection réelle des quotas externes reste l'architecture (clés serveur,
 * devis signés, appels déclenchés par sélection et non par frappe).
 */

interface Window {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, Window>();
const MAX_BUCKETS = 5000;

/**
 * true = requête autorisée. `key` = identifiant logique (ex. 'travel-quote'),
 * l'IP est extraite de x-forwarded-for (premier segment).
 */
export function checkRateLimit(
  key: string,
  request: { headers: { get(name: string): string | null } },
  { max, windowMs }: { max: number; windowMs: number },
): boolean {
  const ip = (request.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim();
  const bucketKey = `${key}:${ip}`;
  const now = Date.now();

  const bucket = buckets.get(bucketKey);
  if (!bucket || now - bucket.windowStart > windowMs) {
    if (buckets.size >= MAX_BUCKETS) buckets.clear(); // garde-fou mémoire
    buckets.set(bucketKey, { count: 1, windowStart: now });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= max;
}
