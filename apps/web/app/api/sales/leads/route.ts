import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/admin-auth';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { leadCreateSchema, leadUpdateSchema } from '@/lib/sales-leads';
import { resolveStaffNames } from '@/lib/staff-names';

/**
 * Prospects du pipeline commercial.
 *
 * POST — créer un prospect (ownerUid = l'appelant).
 * GET — ses prospects ; manager/admin voient tout. Jusqu'à 300, triés par
 *   dernière mise à jour. Le filtrage fin (étape, recherche) est client :
 *   un pipeline de commercial tient en mémoire, et le Kanban a besoin de
 *   toutes les colonnes de toute façon.
 * PATCH { id, ...champs } — mise à jour ; un changement d'étape est
 *   journalisé dans salesActivities (l'historique des passages est la
 *   matière du tunnel, il ne doit jamais se perdre).
 * DELETE ?id= — suppression (RGPD : un prospect peut exiger l'effacement) ;
 *   ses activités partent avec lui.
 */

function serialise(id: string, x: FirebaseFirestore.DocumentData) {
  return {
    id,
    ownerUid: x.ownerUid,
    stage: x.stage,
    lostReason: x.lostReason ?? null,
    businessName: x.businessName,
    contactName: x.contactName ?? null,
    email: x.email ?? null,
    phone: x.phone ?? null,
    city: x.city ?? null,
    sector: x.sector ?? 'beaute',
    isTeam: !!x.isTeam,
    source: x.source ?? null,
    mainPain: x.mainPain ?? null,
    currentPlatform: x.currentPlatform ?? null,
    profileUrl: x.profileUrl ?? null,
    pushedBy: x.pushedBy ?? null,
    notes: x.notes ?? null,
    linkedProviderId: x.linkedProviderId ?? null,
    optOut: !!x.optOut,
    nextActionAt: x.nextActionAt?.toDate?.()?.toISOString() ?? null,
    lastInteractionAt: x.lastInteractionAt?.toDate?.()?.toISOString() ?? null,
    createdAt: x.createdAt?.toDate?.()?.toISOString() ?? null,
    updatedAt: x.updatedAt?.toDate?.()?.toISOString() ?? null,
  };
}

/** Nom normalisé pour la détection de doublons : minuscules, sans accents,
 *  espaces réduits — « Salon Zoé » ≡ « salon  zoe ». */
function nomNormalise(nom: string): string {
  return nom
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Annuaire uid → { nom, initiales } pour les badges d'attribution.
 *  `uidsSupplementaires` : propriétaires SANS fiche staff (admin qui teste…)
 *  résolus via Firebase Auth — un badge doit toujours avoir des initiales. */
async function annuaireEquipe(
  db: FirebaseFirestore.Firestore,
  uidsSupplementaires: Iterable<string> = [],
) {
  const snap = await db.collection('staffMembers').get();
  const fiches = new Map<string, string>();
  snap.docs.forEach((d) => fiches.set(d.id, d.data().displayName ?? '—'));
  return resolveStaffNames(fiches, [...fiches.keys(), ...uidsSupplementaires]);
}

async function leadAccessible(id: string, identity: { uid: string; role: string }) {
  const ref = getAdminFirestore().collection('salesLeads').doc(id);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false as const, status: 404, error: 'Prospect introuvable' };
  if (identity.role === 'sales' && snap.data()?.ownerUid !== identity.uid) {
    return { ok: false as const, status: 403, error: 'Ce prospect ne vous appartient pas' };
  }
  return { ok: true as const, ref, snap };
}

export async function POST(request: NextRequest) {
  const auth = await requireStaff(request);
  if (!auth.ok) return auth.response;

  const brut = await request.json().catch(() => ({}));
  const parsed = leadCreateSchema.safeParse(brut);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Données invalides' },
      { status: 400 },
    );
  }
  const d = parsed.data;
  // « Proposer à l'équipe » : le prospect part dans le POOL (ownerUid null),
  // n'importe quel commercial pourra le prendre en charge. Réservé aux
  // managers — un commercial crée toujours pour lui-même.
  const pourEquipe = brut.pourEquipe === true;
  if (pourEquipe && auth.identity.role === 'sales') {
    return NextResponse.json(
      { error: 'Seul un manager peut proposer un prospect à l’équipe' },
      { status: 403 },
    );
  }
  const db = getAdminFirestore();

  // Anti-doublon (système incitatif 2026-08) : deux commerciaux qui
  // attaquent le même salon, c'est deux crédibilités grillées. Même nom
  // normalisé (et ville compatible) → 409 avec l'attribution, sauf
  // confirmation explicite (forcerDoublon — deux salons homonymes existent).
  if (brut.forcerDoublon !== true) {
    const cible = nomNormalise(d.businessName);
    const villeCible = (d.city ?? '').trim().toLowerCase();
    const existants = await db.collection('salesLeads').limit(500).get();
    const doublon = existants.docs.find((doc) => {
      const x = doc.data();
      if (nomNormalise(x.businessName ?? '') !== cible) return false;
      const ville = (x.city ?? '').trim().toLowerCase();
      // Villes renseignées ET différentes → homonymes plausibles, on laisse.
      return !ville || !villeCible || ville === villeCible;
    });
    if (doublon) {
      const x = doublon.data();
      const equipe = await annuaireEquipe(db, x.ownerUid ? [x.ownerUid] : []);
      const owner = x.ownerUid ? equipe[x.ownerUid] : null;
      return NextResponse.json(
        {
          error: 'Ce salon est déjà dans le pipeline',
          code: 'DOUBLON',
          doublon: {
            id: doublon.id,
            businessName: x.businessName,
            city: x.city ?? null,
            stage: x.stage,
            ownerUid: x.ownerUid ?? null,
            ownerNom: owner?.nom ?? null,
            ownerInitiales: owner?.initiales ?? null,
            estLeMien: x.ownerUid === auth.identity.uid,
            duPool: x.ownerUid === null,
          },
        },
        { status: 409 },
      );
    }
  }

  const ref = await db.collection('salesLeads').add({
    ownerUid: pourEquipe ? null : auth.identity.uid,
    pushedBy: pourEquipe ? auth.identity.uid : null,
    profileUrl: d.profileUrl ?? null,
    stage: d.stage,
    lostReason: null,
    businessName: d.businessName,
    contactName: d.contactName ?? null,
    email: d.email ?? null,
    phone: d.phone ?? null,
    city: d.city ?? null,
    sector: d.sector,
    isTeam: d.isTeam,
    source: d.source ?? null,
    mainPain: d.mainPain ?? null,
    currentPlatform: d.currentPlatform ?? null,
    notes: d.notes ?? null,
    linkedProviderId: null,
    optOut: false,
    nextActionAt: d.nextActionAt ? new Date(d.nextActionAt) : null,
    lastInteractionAt: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  const snap = await ref.get();
  return NextResponse.json({ lead: serialise(ref.id, snap.data()!) });
}

export async function GET(request: NextRequest) {
  const auth = await requireStaff(request);
  if (!auth.ok) return auth.response;

  const db = getAdminFirestore();
  // Égalité seule (pas d'orderBy) : aucune dépendance à un index composite —
  // un index oublié au déploiement a déjà produit des 500. Le tri se fait en
  // mémoire, un pipeline tient largement dans 500 documents.
  const tousSnap = await db.collection('salesLeads').limit(500).get();
  const equipe = await annuaireEquipe(
    db,
    tousSnap.docs.map((d) => d.data().ownerUid).filter((u): u is string => typeof u === 'string'),
  );

  let docs: FirebaseFirestore.QueryDocumentSnapshot[];
  // Les prospects des AUTRES commerciaux — visibilité d'équipe (système
  // incitatif 2026-08) : assez pour savoir qu'un salon est déjà travaillé
  // et par qui, JAMAIS le contact, les notes ni le téléphone d'un confrère.
  let autres: Array<Record<string, unknown>> = [];
  if (auth.identity.role === 'sales') {
    docs = tousSnap.docs.filter((d) => {
      const owner = d.data().ownerUid;
      return owner === auth.identity.uid || owner === null;
    });
    autres = tousSnap.docs
      .filter((d) => {
        const owner = d.data().ownerUid;
        return owner !== auth.identity.uid && owner !== null;
      })
      .map((d) => {
        const x = d.data();
        return {
          id: d.id,
          businessName: x.businessName,
          city: x.city ?? null,
          sector: x.sector ?? 'beaute',
          stage: x.stage,
          lostReason: x.lostReason ?? null,
          ownerUid: x.ownerUid,
          // Contexte NON personnel — jamais le contact, le téléphone ni les
          // notes d'un confrère.
          isTeam: !!x.isTeam,
          currentPlatform: x.currentPlatform ?? null,
          source: x.source ?? null,
          createdAt: x.createdAt?.toDate?.()?.toISOString() ?? null,
          updatedAt: x.updatedAt?.toDate?.()?.toISOString() ?? null,
        };
      })
      .sort((a, b) => ((b.updatedAt as string) ?? '').localeCompare((a.updatedAt as string) ?? ''));
  } else {
    docs = tousSnap.docs;
  }
  const leads = docs
    .map((d) => serialise(d.id, d.data()))
    .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
  return NextResponse.json({ leads, autres, equipe });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireStaff(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const id = typeof body.id === 'string' ? body.id : '';
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 });
  const parsed = leadUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Données invalides' },
      { status: 400 },
    );
  }

  const acces = await leadAccessible(id, auth.identity);
  if (!acces.ok) return NextResponse.json({ error: acces.error }, { status: acces.status });

  const avant = acces.snap.data()!;

  // Réattribution — MANAGER seulement : changer le propriétaire d'un
  // prospect (départ d'un commercial, arbitrage de doublon…). Journalisée,
  // comme tout ce qui touche à l'attribution.
  if ('reassignTo' in body) {
    if (auth.identity.role === 'sales') {
      return NextResponse.json({ error: 'Réservé aux managers' }, { status: 403 });
    }
    const cibleUid = body.reassignTo === null ? null : String(body.reassignTo);
    if (cibleUid !== null) {
      const fiche = await getAdminFirestore().collection('staffMembers').doc(cibleUid).get();
      if (!fiche.exists || fiche.data()?.active !== true) {
        return NextResponse.json({ error: 'Commercial cible introuvable ou inactif' }, { status: 400 });
      }
    }
    if (cibleUid !== (avant.ownerUid ?? null)) {
      const db = getAdminFirestore();
      const equipe = await annuaireEquipe(
        db,
        [avant.ownerUid, cibleUid].filter((u): u is string => typeof u === 'string'),
      );
      const nomAvant = avant.ownerUid ? (equipe[avant.ownerUid]?.nom ?? avant.ownerUid) : 'le pool';
      const nomApres = cibleUid ? (equipe[cibleUid]?.nom ?? cibleUid) : 'le pool';
      await acces.ref.update({
        ownerUid: cibleUid,
        updatedAt: FieldValue.serverTimestamp(),
      });
      await db.collection('salesActivities').add({
        leadId: id,
        authorUid: auth.identity.uid,
        type: 'note',
        stage: null,
        body: `Réattribué : ${nomAvant} → ${nomApres}`,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    const rechargee = await acces.ref.get();
    return NextResponse.json({ lead: serialise(id, rechargee.data()!) });
  }
  const d = parsed.data;
  const maj: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
  for (const champ of [
    'businessName',
    'contactName',
    'email',
    'phone',
    'city',
    'sector',
    'isTeam',
    'source',
    'mainPain',
    'currentPlatform',
    'profileUrl',
    'notes',
    'stage',
    'lostReason',
    'optOut',
  ] as const) {
    if (champ in body && d[champ] !== undefined) maj[champ] = d[champ];
  }
  if ('nextActionAt' in body) {
    maj.nextActionAt = d.nextActionAt ? new Date(d.nextActionAt) : null;
  }

  const db = getAdminFirestore();
  await acces.ref.update(maj);

  // Le passage d'étape se journalise — c'est la matière première du tunnel.
  if (typeof maj.stage === 'string' && maj.stage !== avant.stage) {
    await db.collection('salesActivities').add({
      leadId: id,
      authorUid: auth.identity.uid,
      type: 'changement_etape',
      stage: maj.stage,
      body: `${avant.stage} → ${maj.stage}`,
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  const apres = await acces.ref.get();
  return NextResponse.json({ lead: serialise(id, apres.data()!) });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireStaff(request);
  if (!auth.ok) return auth.response;

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 });
  const acces = await leadAccessible(id, auth.identity);
  if (!acces.ok) return NextResponse.json({ error: acces.error }, { status: acces.status });

  const db = getAdminFirestore();
  // RGPD : l'effacement emporte le journal.
  const activites = await db.collection('salesActivities').where('leadId', '==', id).get();
  const batch = db.batch();
  activites.docs.forEach((a) => batch.delete(a.ref));
  batch.delete(acces.ref);
  await batch.commit();
  return NextResponse.json({ success: true });
}

