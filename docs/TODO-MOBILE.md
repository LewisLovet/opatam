# Mobile - Actions restantes

## Google Places (internationalisation adresses)
- [ ] Remplacer `api-adresse.data.gouv.fr` par Google Places API dans `apps/mobile/app/(pro)/locations.tsx`
- [ ] Creer un composant `GoogleAddressAutocomplete` pour React Native (meme logique que le web)
- [ ] Ajouter un selecteur de pays (grille comme le web) avant l'autocomplete
- [ ] Passer `countryCode` dans la creation/edition de lieu
- [ ] Adapter la validation du code postal par pays
- [ ] Ajouter `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` dans le `.env` mobile (ou utiliser la meme cle)
- [ ] Mettre a jour `useNearbyProviders` pour prendre en compte le pays

## Photos de services
- [ ] Ajouter `photoURL` dans l'affichage des services sur mobile (cards, listes)
- [ ] Ajouter le selecteur de photo portfolio dans le formulaire de service mobile
- [ ] Ajouter le crop d'image (react-native-image-crop-picker ou expo-image-manipulator)
- [ ] Afficher la photo dans le flow de reservation mobile
- [ ] Lightbox sur tap de la photo (zoom plein ecran)

## Warning de reservation (bookingNotice)
- [ ] Ajouter le champ `bookingNotice` dans les settings provider mobile
- [ ] Afficher le warning avant la confirmation de reservation (modal ou banner)
- [ ] Checkbox "J'ai lu et j'accepte" avant de valider

## Donnees partagees (deja fait via packages/shared)
- [x] `photoURL` sur Service (type + schema)
- [x] `bookingNotice` sur ProviderSettings (type + schema)
- [x] `countryCode` sur Location et Provider
- [x] Validations code postal et telephone par pays
- [x] `SUPPORTED_COUNTRIES` constantes
