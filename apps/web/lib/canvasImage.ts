/**
 * Rend une image utilisable dans un canvas exportable.
 *
 * Une image d'une autre origine contamine le canvas où on la dessine, et le
 * navigateur refuse ensuite `toDataURL()` / `toBlob()`. Firebase Storage ne
 * renvoyant pas d'en-tête CORS sur ses GET, tout logo incrusté dans un QR
 * code rendait ce QR non téléchargeable.
 *
 * Faire transiter l'image par notre domaine supprime le problème à la
 * racine : même origine, donc aucune contamination possible.
 *
 * Les URL déjà locales (`/favicon.ico`) et les `data:` sont renvoyées telles
 * quelles — elles ne contaminent rien.
 */
export function canvasSafeImageUrl(src: string | null | undefined): string | undefined {
  if (!src) return undefined;
  if (src.startsWith('data:') || src.startsWith('/')) return src;
  if (!src.startsWith('https://firebasestorage.googleapis.com/')) return src;
  return `/api/logo-proxy?url=${encodeURIComponent(src)}`;
}
