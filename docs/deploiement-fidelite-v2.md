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

## Liens profonds — RETIRÉS le 28/07/2026

Cette section décrivait la mise en place des universal links iOS et des
App Links Android. **Tout a été retiré.**

Raison : un prestataire a l'application, mais quand il réserve chez un
confrère il est un CLIENT. L'interception l'envoyait dans l'espace client
alors que son compte est un compte pro — un état que l'app ne sait pas
tenir (les rôles y sont exclusifs). Le même piège existait pour tout
compte pro recevant un lien du site.

Ce qui a été supprimé :

- `apps/mobile/hooks/useDeepLinks.ts` et son montage dans `app/_layout.tsx` ;
- `expo.android.intentFilters` et `expo.ios.associatedDomains` dans
  `apps/mobile/app.json` — **baké dans le binaire**, donc effectif au
  prochain build seulement ;
- le contenu de `apps/web/public/.well-known/apple-app-site-association`,
  remis à `details: []`. C'est ce fichier qui coupe l'interception sur les
  **builds iOS déjà installés**, sans attendre de mise à jour (iOS le met
  en cache : prise d'effet non instantanée).

Ce qui reste, volontairement :

- la bannière App Store (`apple-itunes-app`) sur les pages du site : c'est
  une incitation au téléchargement, l'app ne s'ouvre que sur appui ;
- la page `/fidelite` et ses boutons vers les stores, désormais toujours
  affichée ;
- le schéma interne `opatam://` (retours d'authentification Google/Apple) ;
- `assetlinks.json` côté web — inoffensif sans `intentFilters` en face.
