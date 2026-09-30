/**
 * Espace membre — invitations et comptes, joués sur l'ÉMULATEUR Firestore.
 *
 * Le vrai code serveur (`espace-membre.ts`, `member-invite.ts`), tel quel,
 * contre une vraie base : qui peut être invité, ce que vaut un lien selon
 * son état, qui peut accepter, ce qu'un retrait d'accès défait.
 *
 * Exécution : ./firestore/run-rules-test.sh (émulateur, projet jetable).
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire, register } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ici = dirname(fileURLToPath(import.meta.url));
const racine = resolve(ici, '../../..');

// Next et Metro importent sans extension et par alias ; `node --test` non.
register('data:text/javascript,' + encodeURIComponent(`
  const WEB = ${JSON.stringify(pathToFileURL(resolve(racine, 'apps/web')).href + '/')};
  const SHARED = ${JSON.stringify(pathToFileURL(resolve(racine, 'packages/shared/src/index.ts')).href)};
  export async function resolve(specifier, context, next) {
    if (specifier === '@booking-app/shared') return next(SHARED, context);
    if (specifier.startsWith('@/')) specifier = WEB + specifier.slice(2);
    try { return await next(specifier, context); }
    catch (e) {
      const relatif = specifier.startsWith('.') || specifier.startsWith('file:');
      if (!relatif || /\\.[cm]?[jt]s$/.test(specifier)) throw e;
      try { return await next(specifier + '.ts', context); }
      catch { return next(specifier + '/index.ts', context); }
    }
  }
`));

process.env.SALES_LINK_SECRET = 'secret-de-test-espace-membre';
const req = createRequire(resolve(racine, 'apps/web/package.json'));
const { initializeApp, getApps } = req('firebase-admin/app');
if (!getApps().length) initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'opatam-rules-test' });
const { getFirestore, Timestamp } = req('firebase-admin/firestore');
const db = getFirestore();

const { preparerInvitation, lireInvitation, accepterInvitation, retirerAcces, estMembreDuSalon } = await import(
  pathToFileURL(resolve(ici, 'espace-membre.ts')).href
);
const { signMemberInvite, verifyMemberInvite } = await import(pathToFileURL(resolve(ici, 'member-invite.ts')).href);

const STUDIO = { businessName: 'Salon Studio', plan: 'team', subscription: { status: 'active', plan: 'team' } };
const SOLO = { businessName: 'Salon Solo', plan: 'solo', subscription: { status: 'active', plan: 'solo' } };
const fiche = (extra = {}) => ({ name: 'Jean Dupont', email: 'Jean@Exemple.test', locationId: 'l1', isActive: true, isDefault: false, ...extra });

before(async () => {
  const pose = (chemin, data) => db.doc(chemin).set(data);
  await pose('providers/em-studio', STUDIO);
  await pose('providers/em-studio/members/m1', fiche());
  await pose('providers/em-studio/members/m2', fiche({ name: 'Lina', email: 'lina@exemple.test' }));
  await pose('providers/em-studio/members/gerant', fiche({ name: 'Gérante', email: 'g@exemple.test', isDefault: true }));
  await pose('providers/em-studio/members/inactif', fiche({ email: 'x@exemple.test', isActive: false }));
  await pose('providers/em-studio/members/sans-email', fiche({ email: '' }));
  await pose('providers/em-solo', SOLO);
  await pose('providers/em-solo/members/s1', fiche({ email: 'solo@exemple.test' }));
  await pose('users/u-pro', { role: 'provider', email: 'pro@exemple.test' });
  await pose('memberAccounts/u-ailleurs', { providerId: 'em-autre', memberId: 'z', email: 'lina@exemple.test', active: true });
});

after(async () => {
  for (const col of ['memberInvitations', 'memberAccounts']) {
    const snap = await db.collection(col).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
});

describe('le jeton du lien', () => {
  it('signé, il ne désigne que l’invitation ; altéré, périmé ou d’un autre usage, refusé', () => {
    const t = signMemberInvite('abcdefgh1234');
    assert.deepEqual(verifyMemberInvite(t), { ok: true, invitationId: 'abcdefgh1234' });
    const [v, corps, mac] = t.split('.');
    assert.equal(verifyMemberInvite(`${v}.${corps}x.${mac}`).ok, false);
    assert.equal(verifyMemberInvite(`si1.${corps}.${mac}`).ok, false, 'un jeton commercial ne vaut pas invitation');
    assert.equal(verifyMemberInvite(t, Date.now() + 8 * 86_400_000).reason, 'expired');
    assert.equal(verifyMemberInvite(signMemberInvite('a/b/c/d/e/f')).reason, 'malformed', 'jamais de « / » vers un chemin');
    for (const x of [undefined, null, 42, '', 'x'.repeat(700)]) assert.equal(verifyMemberInvite(x).ok, false);
  });
});

describe('qui peut être invité', () => {
  it('un membre actif d’un salon Studio, avec une adresse — normalisée', async () => {
    const r = await preparerInvitation(db, 'em-studio', 'm1');
    assert.equal(r.ok, true);
    assert.equal(r.invitation.email, 'jean@exemple.test');
    assert.equal(r.invitation.businessName, 'Salon Studio');
  });
  it('refus : salon Solo, membre principal, membre inactif, sans adresse, inconnu', async () => {
    assert.equal((await preparerInvitation(db, 'em-solo', 's1')).raison, 'plan');
    assert.equal((await preparerInvitation(db, 'em-studio', 'gerant')).raison, 'membre-principal');
    assert.equal((await preparerInvitation(db, 'em-studio', 'inactif')).raison, 'membre-inactif');
    assert.equal((await preparerInvitation(db, 'em-studio', 'sans-email')).raison, 'sans-email');
    assert.equal((await preparerInvitation(db, 'em-studio', 'fantome')).raison, 'membre-introuvable');
    assert.equal((await preparerInvitation(db, 'em-nulle-part', 'm1')).raison, 'salon-introuvable');
  });
  it('réinviter remplace : l’ancien lien cesse de valoir', async () => {
    const a = await preparerInvitation(db, 'em-studio', 'm2');
    const b = await preparerInvitation(db, 'em-studio', 'm2');
    assert.equal((await lireInvitation(db, a.invitation.invitationId)).raison, 'remplacee');
    assert.equal((await lireInvitation(db, b.invitation.invitationId)).ok, true);
  });
});

describe('qui peut accepter', () => {
  it('un compte à une AUTRE adresse : refusé', async () => {
    const r = await preparerInvitation(db, 'em-studio', 'm1');
    const x = await accepterInvitation(db, { invitationId: r.invitation.invitationId, uid: 'u-autre', emailDuCompte: 'autre@exemple.test' });
    assert.equal(x.raison, 'autre-email');
  });
  it('un compte de salon : refusé', async () => {
    await db.doc('providers/em-studio/members/m3').set(fiche({ name: 'Pro', email: 'pro@exemple.test' }));
    const r = await preparerInvitation(db, 'em-studio', 'm3');
    const x = await accepterInvitation(db, { invitationId: r.invitation.invitationId, uid: 'u-pro', emailDuCompte: 'pro@exemple.test' });
    assert.equal(x.raison, 'compte-pro');
  });
  it('déjà membre d’un autre salon : refusé', async () => {
    const r = await preparerInvitation(db, 'em-studio', 'm2');
    const x = await accepterInvitation(db, { invitationId: r.invitation.invitationId, uid: 'u-ailleurs', emailDuCompte: 'lina@exemple.test' });
    assert.equal(x.raison, 'deja-membre');
  });
  it('lien expiré : refusé', async () => {
    const r = await preparerInvitation(db, 'em-studio', 'm1');
    const dans8jours = new Date(Date.now() + 8 * 86_400_000);
    const x = await accepterInvitation(db, { invitationId: r.invitation.invitationId, uid: 'u-jean', emailDuCompte: 'jean@exemple.test' }, dans8jours);
    assert.equal(x.raison, 'expiree');
  });
  it('le bon compte : relié, invitation consommée, fiche utilisateur créée ; un second clic est sans effet', async () => {
    const r = await preparerInvitation(db, 'em-studio', 'm1');
    const id = r.invitation.invitationId;
    const x = await accepterInvitation(db, { invitationId: id, uid: 'u-jean', emailDuCompte: 'JEAN@exemple.test' });
    assert.deepEqual(x, { ok: true, providerId: 'em-studio', memberId: 'm1' });
    const compte = (await db.doc('memberAccounts/u-jean').get()).data();
    assert.equal(compte.providerId, 'em-studio');
    assert.equal(compte.memberId, 'm1');
    assert.equal(compte.active, true);
    const inv = (await db.doc(`memberInvitations/${id}`).get()).data();
    assert.equal(inv.status, 'accepted');
    assert.equal(inv.acceptedBy, 'u-jean');
    const user = (await db.doc('users/u-jean').get()).data();
    assert.equal(user.role, 'client');
    assert.equal(user.email, 'jean@exemple.test');
    assert.deepEqual(await accepterInvitation(db, { invitationId: id, uid: 'u-jean', emailDuCompte: 'jean@exemple.test' }), x);
    const intrus = await accepterInvitation(db, { invitationId: id, uid: 'u-intrus', emailDuCompte: 'jean@exemple.test' });
    assert.equal(intrus.raison, 'acceptee', 'un lien ne sert qu’une fois');
  });
  it('un membre = un compte : réinvité à une nouvelle adresse, l’ancien compte perd l’accès', async () => {
    await db.doc('providers/em-studio/members/m1').update({ email: 'jean.nouveau@exemple.test' });
    const r = await preparerInvitation(db, 'em-studio', 'm1');
    const x = await accepterInvitation(db, { invitationId: r.invitation.invitationId, uid: 'u-jean-2', emailDuCompte: 'jean.nouveau@exemple.test' });
    assert.equal(x.ok, true);
    assert.equal((await db.doc('memberAccounts/u-jean').get()).exists, false, 'ancien compte détaché');
    assert.equal((await db.doc('memberAccounts/u-jean-2').get()).get('memberId'), 'm1');
  });
  it('un salon repassé en Solo : l’invitation encore ouverte ne s’accepte plus', async () => {
    await db.doc('providers/em-studio/members/m4').set(fiche({ name: 'Ana', email: 'ana@exemple.test' }));
    const r = await preparerInvitation(db, 'em-studio', 'm4');
    await db.doc('providers/em-studio').update({ plan: 'solo', subscription: { status: 'active', plan: 'solo' } });
    const x = await accepterInvitation(db, { invitationId: r.invitation.invitationId, uid: 'u-ana', emailDuCompte: 'ana@exemple.test' });
    assert.equal(x.raison, 'plan');
    await db.doc('providers/em-studio').set(STUDIO);
  });
});

describe('retirer l’accès', () => {
  it('détache le compte et retire les invitations en attente ; le membre reste dans l’équipe', async () => {
    await preparerInvitation(db, 'em-studio', 'm2');
    const r = await retirerAcces(db, 'em-studio', 'm1');
    assert.equal(r.comptes, 1);
    assert.equal((await db.doc('memberAccounts/u-jean-2').get()).exists, false);
    const r2 = await retirerAcces(db, 'em-studio', 'm2');
    assert.ok(r2.invitations >= 1);
    const pendantes = (await db.collection('memberInvitations').where('providerId', '==', 'em-studio').get()).docs
      .filter((d) => d.get('memberId') === 'm2' && d.get('status') === 'pending');
    assert.equal(pendantes.length, 0);
    assert.equal((await db.doc('providers/em-studio/members/m2').get()).exists, true);
  });
  it('ne touche jamais un autre salon', async () => {
    await retirerAcces(db, 'em-studio', 'z');
    assert.equal((await db.doc('memberAccounts/u-ailleurs').get()).exists, true);
  });
});

describe('le privilège « pro » d’un membre (créer un rendez-vous sans acompte)', () => {
  it('seulement dans SON agenda, avec un accès actif', async () => {
    await db.doc('memberAccounts/u-priv').set({ providerId: 'em-studio', memberId: 'm2', active: true });
    await db.doc('memberAccounts/u-off').set({ providerId: 'em-studio', memberId: 'm2', active: false });
    assert.equal(await estMembreDuSalon(db, 'u-priv', 'em-studio', 'm2'), true);
    assert.equal(await estMembreDuSalon(db, 'u-priv', 'em-studio', 'm1'), false, 'agenda d’un collègue');
    assert.equal(await estMembreDuSalon(db, 'u-priv', 'em-solo', 'm2'), false, 'autre salon');
    assert.equal(await estMembreDuSalon(db, 'u-off', 'em-studio', 'm2'), false, 'accès désactivé');
    assert.equal(await estMembreDuSalon(db, 'u-inconnu', 'em-studio', 'm2'), false);
    assert.equal(await estMembreDuSalon(db, null, 'em-studio', 'm2'), false);
    assert.equal(await estMembreDuSalon(db, 'u-priv', 'em-studio', null), false);
  });
});
