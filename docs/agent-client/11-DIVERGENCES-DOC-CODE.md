# Divergences entre la documentation existante et le code

> **Document interne** — Ne pas communiquer aux clients.
> **Date de verification** : 13 avril 2026
> **Source** : Comparaison des fichiers /docs/01-PROJET.md a 06-PUBLICATION.md avec le code source reel.

---

## 1. Tarification — Divergences majeures

### Prix des plans
| Source | Plan Solo/Pro | Plan Team/Studio |
|--------|---------------|------------------|
| **01-PROJET.md** | 15 EUR/mois, 100 EUR/an | 15 EUR + 10 EUR/membre |
| **06-PUBLICATION.md** | 17,90 EUR/mois, 179 EUR/an | 29,90 EUR/mois, 239 EUR/an |
| **Code reel (constants/index.ts)** | **19,90 EUR/mois, 199 EUR/an** | **29,90 EUR/mois, 299 EUR/an** |

### Noms des plans
| Source | Plan 1 | Plan 2 |
|--------|--------|--------|
| **01-PROJET.md** | Solo | Team |
| **06-PUBLICATION.md** | Pro | Studio |
| **Code reel** | **Pro** (cle interne: `solo`) | **Studio** (cle interne: `team`) |

### Essai gratuit
| Source | Duree |
|--------|-------|
| **01-PROJET.md** | 7 jours |
| **06-PUBLICATION.md** | 30 jours |
| **Code reel** | **30 jours** |

### Limites des plans
| Source | Pro | Studio |
|--------|-----|--------|
| **06-PUBLICATION.md** | 1 membre, 1 lieu | 5 membres, 5 lieux |
| **Code reel** | **1 membre, 1 lieu** | **10 membres, 10 lieux** |

---

## 2. Modele de donnees — Champs manquants dans la doc

### User (02-DONNEES.md vs code)
Champs presents dans le code mais absents de la doc :
- `notificationSettings: NotificationSettings` (preferences de notification client)
- `affiliateId: string | null`
- `isAdmin?: boolean`
- `isDisabled?: boolean`

### Provider (02-DONNEES.md vs code)
Champs presents dans le code mais absents de la doc :
- `region: string | null` (ex. "Ile-de-France")
- `countryCode: string` (ex. "FR")
- `minPrice: number | null` (prix minimum en centimes)
- `searchTokens: string[]` (pour la recherche full-text)
- `geopoint: { latitude, longitude } | null`
- `affiliateCode: string | null`
- `affiliateId: string | null`
- `stats?: { pageViews: PageViewStats }`
- Plan `'test'` non documente
- Plan `'trial'` non documente (la doc ne liste que `'solo'` | `'team'`)

### Member (02-DONNEES.md vs code)
Differences :
- Doc mentionne `locationIds: string[]` (tableau) — **Code n'a que `locationId: string`** (un seul lieu)
- Doc mentionne `sortOrder` — **Absent du code actuel**
- Code ajoute `color: string | null` (couleur pour le calendrier) — **Absent de la doc**

### Location (02-DONNEES.md vs code)
Differences :
- Doc mentionne `sortOrder` — **Absent du code actuel**
- Code ajoute `countryCode: string` — **Absent de la doc**

### Booking (02-DONNEES.md vs code)
Champs presents dans le code mais absents de la doc :
- `priceMax: number | null`
- `memberColor: string | null`

### Service (02-DONNEES.md vs code)
Champs presents dans le code mais absents de la doc :
- `photoURL: string | null`
- `priceMax: number | null`
- `categoryId: string | null`

### Subscription (03-BACKEND.md vs code)
Differences significatives :
| Champ | Doc | Code |
|-------|-----|------|
| plan | `'solo' \| 'team' \| 'advanced'` | `'trial' \| 'solo' \| 'team' \| 'test'` |
| tier | non documente | `'standard' \| 'advanced'` |
| status | `'active' \| 'cancelled' \| 'past_due' \| 'trialing'` | `'trialing' \| 'active' \| 'past_due' \| 'cancelled' \| 'incomplete'` |
| memberCount | non documente | `number` |
| paymentSource | non documente | `'stripe' \| 'apple' \| 'google' \| null` |
| revenuecatAppUserId | non documente | `string \| null` |

---

## 3. Structure du projet — Elements non documentes

### Cloud Functions manquantes dans la doc
Le code contient ces functions non documentees :
- `onUserWrite` (trigger stats)
- `onProviderWrite` (trigger stats)
- `onBookingWriteStats` (trigger stats)
- `onReviewWrite` (trigger stats)
- `onReviewCreate` (trigger)
- `sendDailyAgendaSummary` (scheduled)
- `aggregatePageViews` (scheduled)
- `checkExpiredTrials` (scheduled)
- `sendSubscriptionReminders` (scheduled)
- `requestPasswordReset` (callable)
- `cancelBooking` (callable)

### Repertoire callable
- Doc dit `/callables/` (pluriel)
- Code utilise `/callable/` (singulier)

### API Routes non documentees
Le code contient 46 routes API (la doc n'en liste que ~10) :
- Section **Admin** complete : `/api/admin/users`, `/api/admin/providers`, `/api/admin/bookings`, `/api/admin/reviews`, `/api/admin/stats`, `/api/admin/affiliates`
- **RevenueCat webhook** : `/api/revenuecat/webhook`
- **Google Places** : `/api/google-places/autocomplete`, `/api/google-places/details`
- **Analytics** : `/api/analytics/track-view`
- **Contact** : `/api/contact`
- **Affiliates** : `/api/affiliates/verify`
- **Stripe change-plan** : `/api/stripe/change-plan`
- **Slots** : `/api/slots`
- **Reviews** : `/api/reviews/submit`
- **Auth welcome email** : `/api/auth/welcome-email`
- **Image proxy** : `/api/image-proxy`
- **Android waitlist** : `/api/android-waitlist`
- **Recrutement** : `/api/recrutement`
- Et plusieurs routes dev/test

### Repositories non documentes
- `serviceCategory.repository.ts`
- `conversation.repository.ts`
- `message.repository.ts`
- `base.repository.ts`

### Services non documentes
- `messaging.service.ts`
- `analytics.service.ts`
- `review.service.ts`

---

## 4. Frontend — Differences majeures

### Web : structure des routes
- Doc dit route groups `(public)` et `(pro)` — **Seul `(auth)` existe comme route group**
- Les routes pro sont a `/pro/*` directement
- Section `/admin/*` complete non documentee
- Section `/dev/*` complete non documentee
- Pages legales (`/cgu`, `/cgv`, `/confidentialite`, `/mentions-legales`) non documentees
- Page `/pricing` non documentee
- Page `/contact` non documentee
- Page `/telechargement` non documentee
- Page `/avis/[bookingId]` non documentee
- Page `/recrutement` non documentee

### Web : routes Pro
- Doc liste : dashboard, calendar, bookings, services, members, locations, availability, profile, settings
- Code reel : `/pro` (dashboard), `/pro/activite` (services), `/pro/reservations` (bookings), `/pro/calendrier` (calendar), `/pro/profil` (profile), `/pro/parametres` (settings), `/pro/avis` (reviews)
- **Differences** : noms de routes differents, `/pro/members`, `/pro/locations`, `/pro/availability` n'existent PAS en tant que routes separees

### Mobile : App Pro
- **Doc dit** : "Placeholder Pro mobile (ecran bientot disponible + deconnexion)"
- **Code reel** : L'app Pro mobile est **COMPLETEMENT IMPLEMENTEE** avec :
  - 5 onglets : Dashboard, Agenda, Creation (+), RDV, Plus
  - Gestion des services, lieux, membres, disponibilites
  - Creation manuelle de reservations
  - Gestion des creneaux bloques
  - Parametres de reservation
  - Paywall / abonnement
  - Statistiques
  - Avis

### Mobile : Contextes
- Doc liste : AuthContext, BookingContext, ProvidersCache, ThemeContext, ToastContext
- Code reel : AuthContext, BookingContext, **ProviderContext** (nouveau), **ProvidersCacheContext** (renomme), **RevenueCatContext** (nouveau)
- ThemeContext et ToastContext ne sont plus dans `/contexts/` mais dans `/theme/` et `/components/`

### Mobile : Hooks supplementaires
Le code contient 26+ hooks vs les 11 documentes. Ajouts notables :
- `useTopProviders`, `useProviderById`, `useServiceCategories`, `useBlockedSlots`
- `useTeamAvailabilities`, `useProviderBookings`, `useNextBooking`
- `useNavigateToProvider`, `useAppReady`, `useDeepLinks`
- `useProviderDashboard`, `useProviderStats`, `useOpeningHours`
- `useProBookingBadges`, `useClientBookingBadges`
- `useUserLocation`, `useNearbyProviders`

---

## 5. Email — Difference d'adresse expediteur

| Source | Expediteur |
|--------|------------|
| **03-BACKEND.md** | `Opatam <noreply@opatam.com>` |
| **Code reel** | `Opatam <noreply@kamerleontech.com>` |
| **Reply-to** (non documente) | `support@kamerleontech.com` |

---

## 6. Version de l'application

| Source | Version |
|--------|---------|
| **06-PUBLICATION.md** | 1.0.0 |
| **Code reel (app.json)** | **1.3.5** |

---

## 7. Fonctionnalites non documentees

### Systeme d'affiliation
- Les prestataires peuvent avoir un code d'affiliation
- Systeme de commission via Stripe Connect
- API dediee (`/api/affiliates/verify`, `/api/admin/affiliates`)
- Transferts automatiques via webhook Stripe

### RevenueCat (achats in-app)
- Integration RevenueCat pour les abonnements in-app (Apple/Google)
- Webhook : `/api/revenuecat/webhook`
- Contexte React Native : `RevenueCatContext`
- Paywall mobile : `/(pro)/paywall.tsx`

### Panel Admin
- Interface complete d'administration (`/admin/*`)
- Gestion des utilisateurs, prestataires, reservations, avis
- Analytics et revenus
- Gestion des affilies
- Verification et changement de codes d'acces

### Google Places
- Integration Google Places API pour l'autocompletion d'adresses
- Routes : `/api/google-places/autocomplete`, `/api/google-places/details`

### Page de recrutement
- Page `/recrutement` et route API `/api/recrutement`

### Analytics de vues de profil
- Tracking des vues de pages prestataires
- Aggregation quotidienne via Cloud Function

---

## Recommandations

1. **Mettre a jour 01-PROJET.md** avec les vrais prix (19,90 EUR/199 EUR et 29,90 EUR/299 EUR) et l'essai de 30 jours
2. **Mettre a jour 02-DONNEES.md** avec les champs manquants (notificationSettings, region, countryCode, affiliates, etc.)
3. **Mettre a jour 03-BACKEND.md** avec les nouvelles Cloud Functions et API routes
4. **Mettre a jour 04-FRONTEND.md** avec la structure reelle des routes web et la completion de l'app Pro mobile
5. **Documenter le systeme d'affiliation, RevenueCat, le panel admin, et Google Places**
6. **Corriger l'adresse email expediteur** dans la doc (kamerleontech.com, pas opatam.com)
