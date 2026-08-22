/**
 * Réconciliation des accès offerts créés par l'ANCIEN octroi admin.
 *
 * CONTEXTE. Jusqu'au commit qui a introduit `computeEntitlements`, accorder un
 * accès offert mutait le document du prestataire : `plan` prenait le tier du
 * comp, `depositsAddonActive` passait à true si Sérénité était offerte, et
 * `isPublished` repassait à true. Ces écritures survivaient à l'expiration ou
 * à la révocation du comp — un compte compé « team » restait Studio à vie.
 *
 * CE QUE FAIT CE SCRIPT, pour chaque document portant `accessOverride` :
 *   - `plan` revient à ce que la FACTURATION justifie (sub.plan si payant,
 *     'trial' sinon) — le tier compé est désormais calculé à la lecture ;
 *   - `depositsAddonActive` revient aux seuls paiements réels
 *     (serenity.status active/trialing) ;
 *   - un comp EXPIRÉ sans droit derrière est dépublié.
 *
 * SÉCURITÉ.
 *   - Dry-run par défaut. `APPLY=1` pour écrire.
 *   - Rapport JSON complet (avant/après + droits effectifs recalculés) écrit
 *     dans scripts/reports/, versionnable et diffable.
 *   - La logique de droits est importée du VRAI module shared — pas une
 *     copie qui pourrait diverger.
 *
 * ORDRE DE DÉPLOIEMENT (impératif, voir docs) : web + functions + règles
 * d'abord, PUIS l'OTA mobile, PUIS une période d'observation, PUIS ce script.
 * Les anciens bundles mobiles lisent encore `provider.plan` : appliquer la
 * migration avant que l'OTA soit largement récupérée ferait perdre
 * l'interface Studio aux comps `team` sur les téléphones non à jour.
 *
 * Usage (depuis la racine du repo) :
 *   npx tsx scripts/migrate-access-overrides.ts            # dry-run
 *   APPLY=1 npx tsx scripts/migrate-access-overrides.ts    # écrit
 */
import fs from 'node:fs';
import path from 'node:path';
import admin from 'firebase-admin';
import { computeEntitlements } from '../packages/shared/src/utils/access';

const ROOT = path.resolve(__dirname, '..');
const saPath = path.join(ROOT, 'service-account.json');
if (!fs.existsSync(saPath)) {
  console.error('service-account.json introuvable à la racine du repo.');
  process.exit(1);
}
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(saPath, 'utf8'))) });
const db = admin.firestore();
const APPLY = process.env.APPLY === '1';

interface Ligne {
  id: string;
  businessName: string;
  avant: Record<string, unknown>;
  apres: Record<string, unknown>;
  droits: { avantMigration: string; apresMigration: string };
  changements: Record<string, { de: unknown; vers: unknown }>;
}

async function main() {
const snap = await db.collection('providers').get();
const rapport: Ligne[] = [];

for (const doc of snap.docs) {
  const p = doc.data();
  if (!p.accessOverride) continue;

  const sub = p.subscription ?? {};
  const paid =
    sub.status === 'active' ||
    sub.status === 'past_due' ||
    (sub.status === 'trialing' && !!(sub.stripeSubscriptionId || sub.revenuecatAppUserId));
  const serenityPaid = p.serenity?.status === 'active' || p.serenity?.status === 'trialing';
  const trialRunning =
    sub.status === 'trialing' && (sub.validUntil?.toDate?.()?.getTime() ?? 0) > Date.now();

  const ent = computeEntitlements(p as never);

  const changements: Ligne['changements'] = {};
  const planJuste = paid ? (sub.plan ?? 'trial') : 'trial';
  if (p.plan !== planJuste) changements.plan = { de: p.plan, vers: planJuste };
  if (p.depositsAddonActive === true && !serenityPaid) {
    changements.depositsAddonActive = { de: true, vers: false };
  }
  if (!ent.compActive && !paid && !trialRunning && p.isPublished === true) {
    changements.isPublished = { de: true, vers: false };
  }
  if (!Object.keys(changements).length) continue;

  const apres = { ...p, ...Object.fromEntries(Object.entries(changements).map(([k, v]) => [k, v.vers])) };
  rapport.push({
    id: doc.id,
    businessName: p.businessName ?? '(sans nom)',
    avant: {
      plan: p.plan,
      depositsAddonActive: p.depositsAddonActive ?? false,
      isPublished: p.isPublished ?? false,
      subscription: { status: sub.status ?? null, plan: sub.plan ?? null },
      serenity: p.serenity?.status ?? null,
      override: {
        active: p.accessOverride.active,
        plan: p.accessOverride.plan,
        serenity: p.accessOverride.serenity ?? false,
        until: p.accessOverride.until?.toDate?.()?.toISOString() ?? null,
      },
    },
    apres: {
      plan: apres.plan,
      depositsAddonActive: apres.depositsAddonActive ?? false,
      isPublished: apres.isPublished ?? false,
    },
    droits: {
      // Les droits effectifs ne changent PAS avec la migration : c'est tout
      // l'intérêt — seule l'empreinte matérialisée est nettoyée.
      avantMigration: JSON.stringify({ plan: ent.effectivePlan, source: ent.source, deposits: ent.canUseDeposits }),
      apresMigration: JSON.stringify((() => { const e = computeEntitlements(apres as never); return { plan: e.effectivePlan, source: e.source, deposits: e.canUseDeposits }; })()),
    },
    changements,
  });

  if (APPLY) {
    await doc.ref.update({
      ...Object.fromEntries(Object.entries(changements).map(([k, v]) => [k, v.vers])),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
}

for (const l of rapport) {
  console.log(`\n${l.businessName} (${l.id})`);
  console.log(`  comp: ${JSON.stringify(l.avant.override)}`);
  console.log(`  facturation: ${JSON.stringify(l.avant.subscription)} | sérénité payée: ${l.avant.serenity ?? '—'}`);
  for (const [k, v] of Object.entries(l.changements)) console.log(`  ${k}: ${JSON.stringify(v.de)} → ${JSON.stringify(v.vers)}`);
  console.log(`  droits avant: ${l.droits.avantMigration}`);
  console.log(`  droits après: ${l.droits.apresMigration}${l.droits.avantMigration === l.droits.apresMigration ? '  (identiques ✓)' : '  ⚠ DIFFÉRENTS'}`);
}

const outDir = path.join(ROOT, 'scripts', 'reports');
fs.mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outFile = path.join(outDir, `access-overrides-${APPLY ? 'apply' : 'dryrun'}-${stamp}.json`);
fs.writeFileSync(outFile, JSON.stringify(rapport, null, 2));
console.log(`\n${rapport.length} document(s) ${APPLY ? 'CORRIGÉS' : 'à corriger (dry-run)'} — rapport : ${path.relative(ROOT, outFile)}`);
process.exit(0);
}

void main();
