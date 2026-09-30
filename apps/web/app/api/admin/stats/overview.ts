/**
 * Tableau de bord admin — vue d'ensemble et séries du grand graphique.
 *
 * Tout est calculé à la lecture depuis Firestore, comptes de test exclus.
 * Une réservation abandonnée au paiement (`pending_payment`) ne compte
 * nulle part : elle n'a jamais existé pour le prestataire.
 *
 * Les montants restent par devise : les FRAIS perçus sont en euro, les
 * autres devises sont rendues à part, jamais additionnées.
 */
import type {
  AdminOverview,
  OverviewProRef,
  SeriesData,
  SeriesMetric,
} from '@/services/admin/types';

const JOUR = 86_400_000;
const PLANS_PAYANTS = new Set(['solo', 'team']);

type Db = FirebaseFirestore.Firestore;
type Donnees = FirebaseFirestore.DocumentData;

/** Clé de journée LOCALE (le serveur tourne à l'heure de Paris), pas UTC. */
export function cleJourLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const enDate = (v: unknown): Date | null => {
  if (!v) return null;
  if (v instanceof Date) return v;
  const t = v as { toDate?: () => Date };
  return typeof t.toDate === 'function' ? t.toDate() : null;
};

/** Minuit (heure locale) il y a `jours` jours. */
function minuitIlYa(jours: number): Date {
  const n = new Date();
  const d = new Date(n.getFullYear(), n.getMonth(), n.getDate());
  d.setDate(d.getDate() - jours);
  return d;
}

/** Série vide de `jours` journées consécutives à partir de `debut`. */
function journees(debut: Date, jours: number): Map<string, number> {
  const m = new Map<string, number>();
  for (let i = 0; i < jours; i++) {
    const d = new Date(debut);
    d.setDate(d.getDate() + i);
    m.set(cleJourLocal(d), 0);
  }
  return m;
}

/** Clé des vues d'une page d'accueil métier : `view:landing:<slug>`. */
const PREFIXE_LANDING = 'view:landing:';

/** Vue d'une page d'accueil : la principale (/) ou une page métier. */
const estVueAccueil = (cle: string) => cle === 'view:home' || cle.startsWith(PREFIXE_LANDING);

/** « cils-sourcils » → « Cils sourcils » : libellé tant qu'aucun registre ne le fournit. */
const libelleDeSlug = (slug: string) => {
  const t = slug.replace(/-/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
};

const estPayant = (d: Donnees) =>
  d.subscription?.status === 'active' && PLANS_PAYANTS.has(d.subscription?.plan);

function refPro(id: string, d: Donnees | undefined, extra: Partial<OverviewProRef> = {}): OverviewProRef {
  return {
    id,
    name: (typeof d?.businessName === 'string' && d.businessName) || 'Sans nom',
    photoURL: typeof d?.photoURL === 'string' && d.photoURL ? d.photoURL : null,
    ...extra,
  };
}

/** Frais de service d'un acompte payé : [date du paiement, montant, devise]. */
function fraisDe(d: Donnees): { paidAt: Date; fee: number; devise: string } | null {
  const fee = Number(d.deposit?.serviceFee) || 0;
  const paidAt = enDate(d.deposit?.paidAt);
  if (fee <= 0 || !paidAt) return null;
  const devise = typeof d.currency === 'string' && d.currency ? d.currency.toUpperCase() : 'EUR';
  return { paidAt, fee, devise };
}

export async function getOverview(db: Db): Promise<AdminOverview> {
  const maintenant = new Date();
  const debut30 = minuitIlYa(29); // 30 journées, aujourd'hui compris
  const debut60 = minuitIlYa(59);
  const debutMois = new Date(maintenant.getFullYear(), maintenant.getMonth(), 1);
  const dans7j = new Date(maintenant.getTime() + 7 * JOUR);
  const ilYa14j = new Date(maintenant.getTime() - 14 * JOUR);

  const [prosSnap, resasSnap, acomptesSnap, supportSnap, vuesSiteSnap] = await Promise.all([
    db.collection('providers')
      .select('businessName', 'photoURL', 'isTest', 'isPublished', 'subscription', 'createdAt', 'currency')
      .get(),
    db.collection('bookings')
      .where('createdAt', '>=', debut60)
      .select('providerId', 'status', 'price', 'currency', 'createdAt')
      .get(),
    db.collection('bookings')
      .where('deposit.status', 'in', ['paid', 'refunded'])
      .select('deposit', 'currency')
      .get(),
    db.collection('supportChats')
      .select('businessName', 'adminUnread', 'lastMessageFrom', 'lastMessageAt', 'updatedAt')
      .get(),
    // Compteurs du site : un document par jour et par clé (`day` à l'heure
    // de Paris). Seules les vues des pages d'accueil servent ici.
    db.collection('siteMetricsDaily').where('day', '>=', cleJourLocal(debut60)).get(),
  ]);

  const pros = new Map<string, Donnees>();
  const test = new Set<string>();
  for (const doc of prosSnap.docs) {
    const d = doc.data();
    if (d.isTest === true) test.add(doc.id);
    else pros.set(doc.id, d);
  }
  const publies = new Set([...pros.entries()].filter(([, d]) => d.isPublished === true).map(([id]) => id));

  // ── Réservations : 30 j, 30 j précédents, courbe, pros qui travaillent ──
  const courbeResas = journees(debut30, 30);
  let resas30 = 0;
  let resasPrec = 0;
  const actifs30 = new Set<string>();
  const actifsPrec = new Set<string>();
  const derniereResa = new Map<string, Date>();
  const avecResa = new Set<string>();
  const duMois = new Map<string, { count: number; revenue: Record<string, number> }>();
  for (const doc of resasSnap.docs) {
    const b = doc.data();
    const p = typeof b.providerId === 'string' ? b.providerId : '';
    if (!p || test.has(p) || b.status === 'pending_payment') continue;
    const cree = enDate(b.createdAt);
    if (!cree) continue;
    avecResa.add(p);
    const der = derniereResa.get(p);
    if (!der || der < cree) derniereResa.set(p, cree);
    if (cree >= debut30) {
      resas30 += 1;
      actifs30.add(p);
      const k = cleJourLocal(cree);
      courbeResas.set(k, (courbeResas.get(k) ?? 0) + 1);
    } else {
      resasPrec += 1;
      actifsPrec.add(p);
    }
    // Top du mois : les annulations ne font pas le chiffre du prestataire.
    if (cree >= debutMois && b.status !== 'cancelled') {
      const e = duMois.get(p) ?? { count: 0, revenue: {} };
      e.count += 1;
      const devise = typeof b.currency === 'string' && b.currency ? b.currency.toUpperCase() : 'EUR';
      e.revenue[devise] = (e.revenue[devise] ?? 0) + (Number(b.price) || 0);
      duMois.set(p, e);
    }
  }

  // ── Frais de service perçus (euro) ────────────────────────────────────
  const courbeFrais = journees(debut30, 30);
  let frais30 = 0;
  let fraisPrec = 0;
  let fraisMois = 0;
  let fraisTotal = 0;
  const fraisAutres: Record<string, number> = {};
  for (const doc of acomptesSnap.docs) {
    const f = fraisDe(doc.data());
    if (!f) continue;
    if (f.devise !== 'EUR') {
      if (f.paidAt >= debut30) fraisAutres[f.devise] = (fraisAutres[f.devise] ?? 0) + f.fee;
      continue;
    }
    fraisTotal += f.fee;
    if (f.paidAt >= debutMois) fraisMois += f.fee;
    if (f.paidAt >= debut30) {
      frais30 += f.fee;
      const k = cleJourLocal(f.paidAt);
      courbeFrais.set(k, (courbeFrais.get(k) ?? 0) + f.fee);
    } else if (f.paidAt >= debut60) {
      fraisPrec += f.fee;
    }
  }

  // ── À faire ───────────────────────────────────────────────────────────
  const essaisQuiFinissent: OverviewProRef[] = [];
  const payantsInactifs: OverviewProRef[] = [];
  const sansPage: OverviewProRef[] = [];
  const nouveaux: string[] = [];
  for (const [id, d] of pros) {
    const cree = enDate(d.createdAt);
    if (d.subscription?.status === 'trialing') {
      const fin = enDate(d.subscription?.validUntil);
      if (fin && fin >= maintenant && fin <= dans7j) {
        essaisQuiFinissent.push(refPro(id, d, { date: fin.toISOString() }));
      }
    }
    if (estPayant(d)) {
      const der = derniereResa.get(id) ?? null;
      if (!der || der < ilYa14j) {
        payantsInactifs.push(refPro(id, d, { date: der ? der.toISOString() : null }));
      }
    }
    if (cree && cree >= debut30) {
      nouveaux.push(id);
      if (d.isPublished !== true) sansPage.push(refPro(id, d, { date: cree.toISOString() }));
    }
  }
  essaisQuiFinissent.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
  // Les plus longtemps silencieux en tête ; « jamais » avant tout le reste.
  payantsInactifs.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
  sansPage.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));

  const messagesEnAttente: OverviewProRef[] = supportSnap.docs
    .map((doc) => ({ doc, d: doc.data() }))
    // Le fil porte l'identifiant du prestataire : les comptes de test sortent.
    .filter(({ doc }) => !test.has(doc.id))
    .filter(({ d }) => (Number(d.adminUnread) || 0) > 0 || d.lastMessageFrom === 'pro')
    .map(({ doc, d }) => {
      const at = enDate(d.lastMessageAt) ?? enDate(d.updatedAt);
      return {
        id: doc.id,
        name: (typeof d.businessName === 'string' && d.businessName) || 'Professionnel',
        photoURL: null,
        date: at ? at.toISOString() : null,
      };
    })
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));

  // ── Top du mois ───────────────────────────────────────────────────────
  const topPros = [...duMois.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([id, e]) => ({ ...refPro(id, pros.get(id)), bookings: e.count, revenue: e.revenue }));

  // ── Pages d'accueil : la principale, puis chaque page métier ──────────
  // Une page métier apparaît dès sa première visite mesurée.
  const aujourdHui = cleJourLocal(maintenant);
  const jour30 = cleJourLocal(debut30);
  const parCle = new Map<string, { today: number; views30: number; previous: number }>();
  for (const doc of vuesSiteSnap.docs) {
    const d = doc.data();
    const cle = typeof d.key === 'string' ? d.key : '';
    const jour = typeof d.day === 'string' ? d.day : '';
    if (!estVueAccueil(cle) || !jour) continue;
    const e = parCle.get(cle) ?? { today: 0, views30: 0, previous: 0 };
    const n = Number(d.count) || 0;
    if (jour >= jour30) e.views30 += n;
    else e.previous += n;
    if (jour === aujourdHui) e.today += n;
    parCle.set(cle, e);
  }
  const pageAccueil = (key: string, label: string, path: string, draft: boolean) => ({
    key,
    label,
    path,
    draft,
    ...(parCle.get(key) ?? { today: 0, views30: 0, previous: 0 }),
  });
  const landingPages = [
    pageAccueil('view:home', 'Accueil', '/', false),
    ...[...parCle.keys()]
      .filter((cle) => cle.startsWith(PREFIXE_LANDING))
      .sort()
      .map((cle) => {
        const slug = cle.slice(PREFIXE_LANDING.length);
        return pageAccueil(cle, libelleDeSlug(slug), `/${slug}`, false);
      }),
  ];

  // ── Activation des pros inscrits en 30 jours ──────────────────────────
  const activation = {
    signedUp: nouveaux.length,
    published: nouveaux.filter((id) => pros.get(id)?.isPublished === true).length,
    firstBooking: nouveaux.filter((id) => avecResa.has(id)).length,
    paying: nouveaux.filter((id) => estPayant(pros.get(id) ?? {})).length,
  };

  return {
    generatedAt: maintenant.toISOString(),
    bookings30: { value: resas30, previous: resasPrec, spark: [...courbeResas.values()] },
    // Le total réunit les publiés et ceux qui travaillent sans l'être (un
    // pro qui saisit lui-même ses rendez-vous) : la jauge reste ≤ 100 %.
    workingPros: { value: actifs30.size, previous: actifsPrec.size, total: new Set([...publies, ...actifs30]).size },
    fees30: {
      value: frais30,
      previous: fraisPrec,
      spark: [...courbeFrais.values()],
      thisMonth: fraisMois,
      allTime: fraisTotal,
      otherCurrencies: fraisAutres,
    },
    todo: {
      trialsEnding: essaisQuiFinissent,
      idlePaying: payantsInactifs,
      unpublished: sansPage,
      pendingMessages: messagesEnAttente,
    },
    topPros,
    activation,
    landingPages,
  };
}

/**
 * Une série jour par jour sur `jours` journées, et la même durée juste
 * avant, pour la comparaison en pointillés.
 */
export async function getSeries(db: Db, metric: SeriesMetric, jours: number): Promise<SeriesData> {
  const debut = minuitIlYa(jours - 1);
  const debutPrec = minuitIlYa(2 * jours - 1);
  const actuelle = journees(debut, jours);
  const precedente = journees(debutPrec, jours);
  const ajouter = (quand: Date, valeur: number) => {
    const k = cleJourLocal(quand);
    if (actuelle.has(k)) actuelle.set(k, (actuelle.get(k) ?? 0) + valeur);
    else if (precedente.has(k)) precedente.set(k, (precedente.get(k) ?? 0) + valeur);
  };

  if (metric === 'bookings') {
    const [resas, prosTest] = await Promise.all([
      db.collection('bookings').where('createdAt', '>=', debutPrec).select('providerId', 'status', 'createdAt').get(),
      db.collection('providers').where('isTest', '==', true).select().get(),
    ]);
    const test = new Set(prosTest.docs.map((d) => d.id));
    for (const doc of resas.docs) {
      const b = doc.data();
      if (b.status === 'pending_payment' || test.has(b.providerId)) continue;
      const cree = enDate(b.createdAt);
      if (cree) ajouter(cree, 1);
    }
  } else if (metric === 'fees') {
    const snap = await db
      .collection('bookings')
      .where('deposit.status', 'in', ['paid', 'refunded'])
      .select('deposit', 'currency')
      .get();
    for (const doc of snap.docs) {
      const f = fraisDe(doc.data());
      if (f && f.devise === 'EUR' && f.paidAt >= debutPrec) ajouter(f.paidAt, f.fee);
    }
  } else if (metric === 'signups') {
    const snap = await db
      .collection('users')
      .where('createdAt', '>=', debutPrec)
      .select('email', 'isAdmin', 'isTest', 'createdAt')
      .get();
    for (const doc of snap.docs) {
      const u = doc.data();
      const interne =
        u.isTest === true ||
        u.isAdmin === true ||
        (typeof u.email === 'string' && u.email.toLowerCase().endsWith('@yopmail.com'));
      const cree = enDate(u.createdAt);
      if (!interne && cree) ajouter(cree, 1);
    }
  } else if (metric === 'home') {
    // Toutes les pages d'accueil réunies : la principale et les pages métier.
    const snap = await db.collection('siteMetricsDaily').where('day', '>=', cleJourLocal(debutPrec)).get();
    for (const doc of snap.docs) {
      const d = doc.data();
      const k = typeof d.day === 'string' ? d.day : '';
      if (typeof d.key !== 'string' || !estVueAccueil(d.key)) continue;
      const v = Number(d.count) || 0;
      if (actuelle.has(k)) actuelle.set(k, (actuelle.get(k) ?? 0) + v);
      else if (precedente.has(k)) precedente.set(k, (precedente.get(k) ?? 0) + v);
    }
  } else {
    // Vues : agrégats quotidiens par prestataire (`date` = AAAA-MM-JJ).
    // Le jour en cours vit sur la fiche du prestataire jusqu'au cumul de la
    // nuit : le dernier point peut paraître bas.
    const snap = await db.collection('pageViewsDaily').where('date', '>=', cleJourLocal(debutPrec)).get();
    for (const doc of snap.docs) {
      const d = doc.data();
      const k = typeof d.date === 'string' ? d.date : '';
      const v = Number(d.count) || 0;
      if (actuelle.has(k)) actuelle.set(k, (actuelle.get(k) ?? 0) + v);
      else if (precedente.has(k)) precedente.set(k, (precedente.get(k) ?? 0) + v);
    }
  }

  const enSerie = (m: Map<string, number>) => [...m.entries()].map(([date, value]) => ({ date, value }));
  return { metric, days: jours, current: enSerie(actuelle), previous: enSerie(precedente) };
}
