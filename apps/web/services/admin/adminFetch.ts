import { getAuth } from 'firebase/auth';

/**
 * En-têtes des appels au back-office : le jeton Firebase de la session.
 *
 * Remplace les sept fonctions locales qui envoyaient `x-admin-uid` — un uid
 * déclaré par le client, que le serveur croyait sur parole. Le serveur
 * n'accepte plus que le Bearer et en extrait l'identité lui-même.
 *
 * Le paramètre `adminUid` des services est conservé pour ne pas toucher aux
 * dizaines d'appels des écrans : il ne sert plus qu'à l'API des services,
 * l'identité réelle vient du jeton.
 */
export async function adminHeaders(): Promise<Record<string, string>> {
  const user = getAuth().currentUser;
  if (!user) throw new Error('Session expirée — reconnectez-vous');
  const token = await user.getIdToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}
