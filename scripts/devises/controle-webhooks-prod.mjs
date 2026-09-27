/**
 * Contrôle de PRODUCTION des webhooks Stripe — lecture seule.
 *
 * Même évaluation que la route `deposits-prod-check` (module partagé
 * `apps/web/lib/stripe-webhook-requirements.ts`), exécutée ici avec la clé
 * LIVE pour lister les points de terminaison. Ne crée, ne modifie et ne
 * supprime rien. N'affiche aucun secret.
 *
 *   node --experimental-strip-types scripts/devises/controle-webhooks-prod.mjs
 */
import fs from 'node:fs';
import Stripe from 'stripe';
import {
  REQUIRED_PLATFORM_EVENTS,
  REQUIRED_CONNECT_EVENTS,
  evaluateEvents,
} from '../../apps/web/lib/stripe-webhook-requirements.ts';

const env = fs.readFileSync('apps/web/.env.local', 'utf8');
const live = env.match(/^STRIPE_SECRET_KEY=(.+)$/m)?.[1]?.trim().replace(/^["']|["']$/g, '');
if (!live?.startsWith('sk_live')) { console.error('clé live illisible'); process.exit(1); }
const stripe = new Stripe(live);
const eps = (await stripe.webhookEndpoints.list({ limit: 50 })).data;
const connect = eps.filter((e) => !!e.application);
const platform = eps.filter((e) => !e.application);
let rouge = 0;
const ligne = (ok, l, d = '') => { console.log(`  ${ok ? '✓' : '✗'} ${l}${d ? ' — ' + d : ''}`); if (!ok) rouge++; };

console.log('MODE PRODUCTION (live)');
console.log(`\nConnect : ${connect.length} point(s)`);
const rc = evaluateEvents(connect, REQUIRED_CONNECT_EVENTS);
ligne(rc.activeCount > 0, 'point de terminaison Connect actif', `${rc.activeCount} actif(s)`);
for (const ev of REQUIRED_CONNECT_EVENTS) ligne(!rc.missing.includes(ev), ev);
console.log(`\nPlateforme : ${platform.length} point(s)`);
const rp = evaluateEvents(platform, REQUIRED_PLATFORM_EVENTS);
ligne(rp.activeCount > 0, 'point de terminaison plateforme actif', `${rp.activeCount} actif(s)`);
for (const ev of REQUIRED_PLATFORM_EVENTS) ligne(!rp.missing.includes(ev), ev);
console.log(`\n${rouge === 0 ? 'CONTRÔLE VERT' : `${rouge} manque(s)`}`);
process.exit(rouge === 0 ? 0 : 1);
