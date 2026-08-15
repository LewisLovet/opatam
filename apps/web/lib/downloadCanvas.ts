/**
 * Télécharge le contenu d'un canvas en PNG.
 *
 * POURQUOI PASSER PAR UN BLOB plutôt que par `toDataURL()` : une data URL
 * embarque l'image entière dans l'attribut `href`, en base64 — soit un tiers
 * de poids en plus, et une chaîne de plusieurs centaines de kilo-octets pour
 * un QR en 1024 px. Les navigateurs plafonnent la taille des data URL qu'ils
 * acceptent de télécharger, et surtout ils échouent SANS RIEN DIRE quand la
 * limite est franchie : le clic ne produit aucun fichier, aucune erreur.
 *
 * `toBlob()` + `URL.createObjectURL()` n'a pas cette limite : le navigateur
 * reçoit une référence vers des octets qu'il détient déjà.
 *
 * L'URL d'objet est révoquée après coup — sans quoi les octets restent en
 * mémoire jusqu'au rechargement de la page.
 *
 * Renvoie `false` si l'export a été refusé (canvas contaminé par une image
 * d'une autre origine) : l'appelant peut alors prévenir plutôt que de
 * laisser croire au succès.
 */
export async function downloadCanvasAsPng(
  canvas: HTMLCanvasElement,
  filename: string,
): Promise<boolean> {
  const blob = await new Promise<Blob | null>((resolve) => {
    try {
      canvas.toBlob((b) => resolve(b), 'image/png');
    } catch {
      // SecurityError : le canvas contient une image d'une autre origine.
      resolve(null);
    }
  });

  if (!blob) return false;

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  // Firefox n'honore un clic programmatique que sur un lien présent dans le
  // document.
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Laisser au navigateur le temps de s'emparer du blob avant de le libérer.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
  return true;
}
