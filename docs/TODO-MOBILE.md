# Mobile - Actions restantes

## Google Places (internationalisation adresses)
- [ ] Remplacer `api-adresse.data.gouv.fr` par Google Places API dans `apps/mobile/app/(pro)/locations.tsx`
- [ ] Creer un composant `GoogleAddressAutocomplete` pour React Native (meme logique que le web)
- [ ] Ajouter un selecteur de pays (grille comme le web) avant l'autocomplete
- [ ] Passer `countryCode` dans la creation/edition de lieu
- [ ] Adapter la validation du code postal par pays
- [ ] Ajouter `GOOGLE_MAPS_API_KEY` dans le `.env` mobile
- [ ] Mettre a jour `useNearbyProviders` pour prendre en compte le pays

## Photos de services
- [ ] Ajouter `photoURL` dans l'affichage des services sur mobile (cards, listes)
- [ ] Ajouter le selecteur de photo portfolio dans le formulaire de service mobile
- [ ] Ajouter le crop d'image (expo-image-manipulator pour le crop)
- [ ] Afficher la photo dans le flow de reservation mobile
- [ ] Lightbox sur tap de la photo (zoom plein ecran)

## Warning de reservation (bookingNotice)
- [ ] Ajouter le champ `bookingNotice` dans les settings provider mobile (si ecran settings existe)
- [ ] Afficher le bookingNotice en modal quand le client selectionne un service (page provider + flow de reservation)
- [ ] Boutons "Retour" et "J'ai compris, continuer"
- [ ] Apres "J'ai compris" → continuer le flow de reservation normalement

## Filtre pays dans la recherche
- [ ] Ajouter un dropdown ou selecteur de pays dans la page de recherche mobile
- [ ] Filtrer les providers par `countryCode` (cote client)

## Donnees partagees (deja fait via packages/shared)
- [x] `photoURL` sur Service (type + schema)
- [x] `bookingNotice` sur ProviderSettings (type + schema)
- [x] `countryCode` sur Location et Provider
- [x] Validations code postal et telephone par pays
- [x] `SUPPORTED_COUNTRIES` constantes
- [x] `getCountryLabel()` utilitaire
