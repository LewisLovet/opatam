/**
 * Configuration runtime centrale : URL de l'API web + clés publiques.
 *
 * POURQUOI CE FICHIER EXISTE :
 * Expo CLI lit les `EXPO_PUBLIC_*` depuis `.env.local` pour TOUTE commande
 * lancée en local — y compris `eas update`. Comme `.env.local` contient des
 * valeurs de DEV (URL d'API en réseau local `192.168.x`, clé Stripe TEST) et
 * qu'il est gitignoré, un `eas update` lancé depuis une machine de dev
 * embarquerait ces valeurs de dev dans le bundle OTA de PRODUCTION → bookings
 * cassés (« Network request failed »), acomptes Stripe cassés (pk_test vs
 * serveur live) et popup iOS « Réseau local » (connexion à une IP privée).
 *
 * Pour rendre cette erreur IMPOSSIBLE : en production (`__DEV__ === false`) on
 * n'utilise JAMAIS les valeurs injectées par l'env et on force les valeurs
 * canoniques de prod. En dev, on honore `.env.local` (serveur local, Stripe
 * test). La clé publishable est publique par nature (faite pour être
 * embarquée dans l'app).
 */

// Valeurs canoniques de production.
const PROD_API_URL = 'https://opatam.com';
const PROD_STRIPE_PUBLISHABLE_KEY =
  'pk_live_51SvdZxRzY6soe6MNQ3alU4QUOLUoC510oA6EB59LZqkHIKMdxj1zYDC53zRQowGoxFBVmAvTLRbQtyOU00AyZ7qz00FiZk7Sf9';

const envApiUrl = process.env.EXPO_PUBLIC_APP_URL;
const envStripeKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;

/**
 * En dev, l'IP du Mac change au gré du DHCP et `.env.local` devient stale
 * (source récurrente de « ça charge indéfiniment »). Le téléphone connaît
 * forcément l'hôte du Mac : il y charge le bundle Metro. On dérive donc
 * l'URL d'API de `hostUri` (ex. « 192.168.1.147:8083 » → port 3000), avec
 * `.env.local` en secours (simulateur/cas exotiques). Jamais utilisé en
 * production (`__DEV__ === false`).
 */
function deriveDevApiUrl(): string | null {
  try {
    // Import à l'exécution : expo-constants est toujours présent dans
    // l'app, mais on reste défensif (tests node, etc.).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Constants = require('expo-constants').default;
    const hostUri: string | undefined =
      Constants?.expoConfig?.hostUri ?? Constants?.expoGoConfig?.debuggerHost;
    const host = hostUri?.split(':')[0];
    return host ? `http://${host}:3000` : null;
  } catch {
    return null;
  }
}

/** URL de base de l'API web. Toujours opatam.com en production. */
export const API_URL = __DEV__
  ? deriveDevApiUrl() ?? envApiUrl ?? PROD_API_URL
  : PROD_API_URL;

/** Clé publishable Stripe. Toujours la clé LIVE en production. */
export const STRIPE_PUBLISHABLE_KEY =
  __DEV__ && envStripeKey ? envStripeKey : PROD_STRIPE_PUBLISHABLE_KEY;
