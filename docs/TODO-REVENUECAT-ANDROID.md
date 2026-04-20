# TODO — Finaliser l'intégration RevenueCat Android

## État actuel (20 avril 2026)

- ✅ SDK `react-native-purchases` installé
- ✅ `RevenueCatContext` codé avec `Purchases.configure` + `logIn`
- ✅ Paywall mobile (`apps/mobile/app/(pro)/paywall.tsx`)
- ✅ Webhook `/api/revenuecat/webhook` (8 event types)
- ✅ Entitlements `solo_access` / `team_access` définis côté RevenueCat
- ✅ Service account `revenucat-play-store@opatam-da04b.iam.gserviceaccount.com`
  créé + permissions Play Console accordées
- ✅ Les 3 API (subscriptions, inappproducts, monetization) passent au vert
  dans RevenueCat
- ✅ Clé API Android ajoutée dans EAS (toutes envs)
- ✅ Setup iOS déjà fonctionnel (déjà live)

## Reste à faire

### 1. Créer les 4 produits d'abonnement dans Play Console
Play Console → Opatam → Monétiser avec Play → Abonnements.

IDs **exacts** (hardcodés dans le webhook) :

| Product ID | Nom affiché | Prix | Durée |
|---|---|---|---|
| `opatam_solo_monthly` | Opatam Pro – Mensuel | 17,99 € | 1 mois |
| `opatam_solo_yearly` | Opatam Pro – Annuel | 179,99 € | 1 an |
| `opatam_team_monthly` | Opatam Studio – Mensuel | 29,99 € | 1 mois |
| `opatam_team_yearly` | Opatam Studio – Annuel | 239,99 € | 1 an |

⚠️ Pour qu'un produit passe en statut **"Actif"** (et pas brouillon), l'app
doit avoir au moins une release active en **internal testing**.

### 2. Importer les produits dans RevenueCat
RevenueCat → **Products** → **Import from Play Store**.

### 3. Attacher aux Entitlements
- `solo_access` → attach `opatam_solo_monthly` + `opatam_solo_yearly`
- `team_access` → attach `opatam_team_monthly` + `opatam_team_yearly`

### 4. Ajouter à l'Offering "current"
RevenueCat → Offerings → current → Add packages → inclure les 4 produits Android.

### 5. (Bonus) Google developer notifications (RTDN)
Pour recevoir les events Play en temps réel (~secondes) plutôt que via polling
(~minutes). Non bloquant.

1. Google Cloud Console (projet `opatam-da04b`) → Pub/Sub → Créer un sujet
   `play-store-rtdn`
2. Donner à Google le droit de publier dessus (rôle `Pub/Sub Publisher`
   sur `google-play-developer-notifications@system.gserviceaccount.com`)
3. Play Console → Monétisation → Notifications en temps réel →
   `projects/opatam-da04b/topics/play-store-rtdn`
4. RevenueCat → section "Google developer notifications" → sélectionner
   le topic dans le dropdown → Connect to Google

### 6. Test end-to-end
- Build Android : `eas build --platform android --profile production`
- Upload en internal testing sur Play Console
- Ajouter son compte Google dans Configuration → Tests de licence
  (achats facturés 0 €)
- Sur un vrai device Android (pas émulateur — Play Billing sandbox n'y
  marche pas), faire un achat → vérifier :
  - RevenueCat Dashboard → Customers → l'achat apparaît
  - Firestore → `_webhookLogs` → event `INITIAL_PURCHASE`
  - Firestore → `providers/{providerId}.subscription.paymentSource` =
    `'google'`, `status` = `'active'`

## Pièges connus

- Les produits restent "Inactive" dans Play Console tant qu'aucune release
  active. Si blocage, vérifier qu'au moins un build tourne en internal
  testing.
- Propagation Google jusqu'à 36 h entre "je coche une permission" et
  "l'API la reconnaît". Si des erreurs persistent après setup, attendre.
- `react-native-purchases` ne marche pas dans Expo Go sur Android. Tester
  avec `eas build --profile development` sur un dev build.
- Vérifier dans RevenueCat → Integrations que le webhook est bien activé
  pour le projet Android aussi (pas que iOS).
