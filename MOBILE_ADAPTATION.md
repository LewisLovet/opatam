# Adaptation mobile — Variations / Options + Multi-prestations

Référence pour porter sur l'app mobile (Expo/React Native) la feature livrée sur le web
(branche `feat/prestation-variations-editor`).

## TL;DR
La **logique métier est dans les packages partagés** (`@booking-app/shared`,
`@booking-app/firebase`) → déjà dispo côté mobile. Il ne reste que **l'UI à reproduire en RN**
et à **envoyer `selections` / `items`** lors de la création de réservation.

---

## 1. Déjà partagé (rien à réécrire)

### `@booking-app/shared`
- **Types** (`types/index.ts`)
  - `ServiceVariation`, `ServiceVariationOption`, `ServiceOption`, `ServiceInfoField`
    (type `'select' | 'text' | 'boolean'`)
  - `Service.variations? / options? / infoFields?`
  - `Booking.items?: BookingServiceItem[]` + `selectedVariations / selectedOptions / selectedInfoValues`
- **Schémas Zod** (`schemas/`)
  - `createServiceSchema` / `updateServiceSchema` (variations/options/infoFields ; durée d'un choix max **1440 min**)
  - `createBookingSchema` (+ `selections`, `items`), `serviceSelectionsSchema`
- **Calcul de prix** (`utils/service-pricing.ts`)
  - `computeServiceTotal`, `getServiceMinPrice`, `getServiceMinDuration`,
    `validateServiceSelections`, `buildBookingSelections`, `serviceHasChoices`,
    `emptyServiceSelections`, type `ServiceSelections`
  - **Règle de prix** :
    - des **variations** présentes ⇒ elles **définissent** prix + durée (le prix de base ne s'ajoute plus)
    - les **options** s'**ajoutent** au total
    - plus de `priceMax` (la fourchette « à partir de » vient des variations)

### `@booking-app/firebase`
- `catalog.service` : `createService` persiste variations/options/infos ;
  `updateProviderMinPrice` via `getServiceMinPrice` ; `deleteService` vérifie aussi `items[]`.
- `booking.service.createBooking` : accepte `selections` (mono) **ou** `items[]` (multi),
  **recalcule prix+durée côté serveur**, agrège, acompte = somme des acomptes par prestation ;
  `reschedule` utilise `booking.duration` (somme stockée).
- `scheduling.service.getAvailableSlots` : param `durationOverride` (durée totale du bloc).

### API web (si le mobile y passe)
- `POST /api/bookings` : accepte `selections` et `items`.
- `GET /api/slots` : accepte `duration` (override).

### Functions (emails / stats) — **rien à faire côté mobile** (partagé, déjà déployé).

---

## 2. À faire côté mobile (UI RN)

1. **Création de réservation** : envoyer
   - mono : `{ serviceId, selections }`
   - multi : `{ serviceId: items[0].serviceId, items: [{ serviceId, selections }, …] }`
   - Si appel direct à `bookingService.createBooking` → l'agrégation se fait toute seule.
2. **Créneaux** : passer `durationOverride` = durée totale effective
   (Σ `computeServiceTotal(svc, sel).duration` + buffer de la dernière prestation).
3. **Écrans à reproduire** (équivalents web entre parenthèses) :
   - **Éditeur de prestation pro** : variations / options / infos + choix « Prix & durée »
     incluant « Selon les variations » (`app/pro/activite/prestations/**`).
   - **Picker de choix client** : radios (variations) + checkboxes (options, avec variations/infos
     imbriquées) + infos texte / Oui-Non / liste
     (`components/booking/ServiceChoicesPicker.tsx`).
   - **Panier multi-prestations** : « + Ajouter » par prestation, liste + total, badge « ✓ Ajouté »,
     Continuer avec compteur+total (`BookingFlow` client, `CreateBookingModal` pro).
   - **Détail RDV / confirmation** : lister `booking.items` (nom · durée · prix) quand multi.
4. **Affichage prix** : `getServiceMinPrice` ⇒ « à partir de X € » ; `computeServiceTotal` ⇒ total live.

---

## 3. Fichiers web de référence (pour les équivalents RN)
- **Pro éditeur** : `app/pro/activite/prestations/**` (nouveau), `PrestationsTab.tsx`,
  `ServiceCard.tsx` ; `ServiceModal.tsx` **supprimé**.
- **Réservation client** : `app/p/[slug]/reserver/components/{BookingFlow,StepService,StepSlot,BookingRecap}.tsx`,
  `components/ServiceItem.tsx`, `app/p/[slug]/page.tsx`.
- **Pro résa manuelle** : `app/pro/calendrier/components/CreateBookingModal.tsx`.
- **Détails/affichage** : `components/booking/{ServiceChoicesPicker,BookingDetailModal}.tsx`,
  `app/reservation/confirmation/[id]/*`, `app/admin/bookings/[bookingId]/page.tsx`.

---

## 4. Rétrocompatibilité (à respecter en mobile aussi)
- Une prestation **sans** variations/options/infos = comportement identique à avant.
- Un `Booking` **sans** `items` = mono-prestation (champs top-level inchangés).
- Ne pas afficher de fourchette saisie à la main (retirée) — la fourchette vient des variations.
