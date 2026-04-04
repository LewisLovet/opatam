# Mobile - Actions restantes

## Haute priorite

### Photos de services
- [ ] Afficher `photoURL` dans les cards de service (cote client + cote pro)
- [ ] Afficher la photo dans le flow de reservation mobile
- [ ] Lightbox sur tap de la photo (zoom plein ecran)

### Warning de reservation (bookingNotice)
- [ ] Afficher le bookingNotice en modal quand le client selectionne un service
- [ ] Boutons "Retour" et "J'ai compris, continuer"
- [ ] Ajouter le champ `bookingNotice` dans les settings provider mobile

### Pays sur les lieux
- [ ] Afficher le pays dans les cartes de lieu (comme sur le web, sauf si FR)

### UX Localisation (alignement avec le web)
- [ ] Remplacer la checkbox "Ville uniquement" par deux boutons clairs (Adresse precise / Ville uniquement)
- [ ] Transformer le selecteur de pays en dropdown (comme sur le web)
- [ ] Cacher le champ code postal en mode "Ville uniquement"
- [ ] Nom du lieu : dropdown avec options predefinies (Mon salon, Mon cabinet, etc.) + "Autre" avec champ libre
- [ ] Appliquer dans le formulaire de creation de lieu
- [ ] Appliquer dans le flow d'inscription pro (si applicable sur mobile)

### Inscription pro (alignement avec le web)
- [ ] Permettre l'ajout de plusieurs services des l'inscription
- [ ] Validation telephone internationale (accepter +XX au lieu de 06/07 uniquement)

## Moyenne priorite

### Google Places (internationalisation adresses)
- [ ] Remplacer `api-adresse.data.gouv.fr` par Google Places API dans `apps/mobile/app/(pro)/locations.tsx`
- [ ] Creer un composant `GoogleAddressAutocomplete` pour React Native (meme logique que le web)
- [ ] Ajouter un selecteur de pays (dropdown) avant l'autocomplete
- [ ] Passer `countryCode` dans la creation/edition de lieu
- [ ] Adapter la validation du code postal par pays
- [ ] Ajouter `GOOGLE_MAPS_API_KEY` dans le `.env` mobile
- [ ] Mettre a jour `useNearbyProviders` pour prendre en compte le pays

### Filtre pays dans la recherche
- [ ] Ajouter un dropdown pays dans la page de recherche mobile
- [ ] Filtrer les providers par `countryCode` (cote client)

## Basse priorite

### Crop d'image pour les services
- [ ] Ajouter le selecteur de photo portfolio dans le formulaire de service pro
- [ ] Ajouter le crop d'image (expo-image-manipulator)

### Page de recrutement
- [ ] Rediriger vers opatam.com/recrutement via lien externe (pas de page native)

### Erreurs de navigation
- [ ] Gerer les deep links invalides, provider introuvable
- [ ] Ecran d'erreur propre avec bouton retour

### Tests
- [ ] Tests unitaires sur les hooks partages
- [ ] Tests E2E du flow de reservation (Detox ou Maestro)

## Pas de build necessaire (fixes serveur)
- [x] Fix timezone (TZ=Europe/Paris cote API routes Vercel)
- [x] Fix reviews (API route + Firestore rules)

## Donnees partagees (deja fait via packages/shared)
- [x] `photoURL` sur Service (type + schema)
- [x] `bookingNotice` sur ProviderSettings (type + schema)
- [x] `countryCode` sur Location et Provider
- [x] Validations code postal et telephone par pays
- [x] `SUPPORTED_COUNTRIES` constantes
- [x] `getCountryLabel()` utilitaire
- [x] `isValidPostalCode()` et `isValidPhone()` par pays
