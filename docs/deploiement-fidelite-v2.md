# Déploiement fidélité v2 — ordre des opérations et compatibilité

Rédigé le 2026-07-25. Trois contraintes à concilier : (1) le code en ligne
et les apps installées ne changent pas au même instant, (2) le build 1.6.0
doit passer la revue Apple, (3) aucun client ne doit perdre sa récompense
pendant la transition.

## Le point critique : qui décide qu'une carte est « activée »

`isLoyaltyCardActivated()` (packages/shared/src/utils/loyalty.ts) répond
**oui** si `loyaltyActivatedAt` existe **OU** si la fiche client a été créée
avant `LOYALTY_V2_AT` (25/07/2026). Ce **grandfathering vit dans le code**,
pas seulement dans la migration.

Conséquence : l'ordre de déploiement n'a plus d'importance pour les clients
existants, et le script de migration devient un confort (rendre l'état
explicite pour l'UI), pas une condition de survie.

**Piège si on s'était contenté de la migration** : l'ancien trigger déployé
écrit `ref.set(client, { merge: false })` en ne préservant que
`notes`/`preferences`. Un `loyaltyActivatedAt` écrit par la migration
aurait été **effacé** au premier write de résa de ce client, tant que les
functions n'étaient pas à jour. La migration seule n'était donc PAS sûre
avec le code en ligne — le grandfathering règle le problème.

## Ordre recommandé

1. **`firebase deploy --only functions`** — le nouveau trigger préserve
   les champs v2 et le trigger promo arrive. Rétrocompatible : fonctionne
   parfaitement avec le web et le mobile actuels.
2. **Push web (Vercel)** — gate d'activation + APIs + page /fidelite +
   AASA. Rétrocompatible grâce au grandfathering.
3. **`node scripts/migrate-loyalty-v2-autoactivate.mjs`** — optionnel,
   idempotent, rend l'activation explicite sur les cartes entamées.
4. **`eas update` vers le runtime 1.5.0** (voir ci-dessous) — les clients
   actuels reçoivent l'écran d'activation le jour même.
5. **`eas build` 1.6.0 → revue Apple → publication**, puis `eas update`
   vers le runtime 1.6.0 avec le même JS.

## Publier l'OTA aux utilisateurs actuels (runtime 1.5.0)

`app.json` porte `version: 1.6.0` et la policy `runtimeVersion: appVersion`
— tel quel, `eas update` cible un runtime que **personne n'a encore**.

Pour livrer aux utilisateurs installés (1.5.0) :

```bash
# 1. repasser temporairement la version à 1.5.0
# 2. eas update --channel production --message "fidélité v2"
# 3. remettre 1.6.0 avant de lancer le build
```

**Tout le code actuel est OTA-safe pour 1.5.0** : le seul module natif
ajouté (expo-store-review) est chargé par `require` paresseux sous
try/catch dans `lib/appReview.ts` — sur un binaire 1.5.0 l'appel est un
no-op, jamais un crash.

**Règle pendant la revue Apple** : tant que les deux runtimes coexistent,
tout correctif doit être publié **sur les deux** (1.5.0 et 1.6.0), sinon
une partie du parc reste en arrière.

## Fenêtre de discordance résiduelle

Entre le push web et l'OTA mobile, un client **entièrement nouveau** (fiche
créée après le 25/07) verrait sa jauge se remplir sans jamais armer la
récompense, faute de bouton d'activation dans l'app 1.5.0 d'origine.
L'OTA du même jour referme cette fenêtre. Les clients existants ne sont
jamais concernés (grandfathering).

## Universal links — à faire avant de compter dessus

`apps/web/public/.well-known/apple-app-site-association` était **vide**
(`details: []`) : les liens `opatam.com/avis/…` et
`/reservation/confirmation/…` n'ouvraient donc **jamais** l'app sur iOS
depuis le début. Le fichier déclare désormais `/fidelite`, `/avis/*` et
`/reservation/confirmation/*`, mais l'`appID` contient encore le
placeholder **`REMPLACER_TEAM_ID`** — à remplacer par l'identifiant
d'équipe Apple (App Store Connect → Membership) avant le push.

Android était correctement configuré (assetlinks.json) ; le chemin
`/fidelite` a été ajouté aux `intentFilters` — c'est **baké dans le
binaire**, donc actif seulement à partir du build 1.6.0.
