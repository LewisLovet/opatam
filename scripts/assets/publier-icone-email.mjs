/**
 * Publie l'icône du bouton d'appel dans les assets publics (Firebase
 * Storage), là où vivent déjà les logos des e-mails. Écriture ADDITIVE sur
 * un chemin neuf : `assets/icons/phone.png`. Les règles Storage donnent la
 * lecture publique sur `assets/**` et interdisent l'écriture au client —
 * seul le SDK admin écrit ici, comme pour les logos.
 */
import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const BUCKET = 'opatam-da04b.firebasestorage.app';
const CHEMIN = 'assets/icons/phone.png';
const sa = JSON.parse(readFileSync(resolve(process.cwd(), 'service-account.json'), 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(sa), storageBucket: BUCKET });

const source = process.argv[2];
if (!existsSync(source)) { console.error('fichier introuvable :', source); process.exit(1); }

const bucket = admin.storage().bucket();
const fichier = bucket.file(CHEMIN);
const [existeDeja] = await fichier.exists();
console.log(existeDeja ? 'REMPLACEMENT d’un fichier existant' : 'Création (chemin neuf)');

await bucket.upload(source, {
  destination: CHEMIN,
  metadata: { contentType: 'image/png', cacheControl: 'public, max-age=31536000, immutable' },
});
const url = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(CHEMIN)}?alt=media`;
const rep = await fetch(url);
console.log('URL   :', url);
console.log('HTTP  :', rep.status, rep.headers.get('content-type'), rep.headers.get('content-length'), 'octets');
