# Google Places - Actions restantes

## Haute priorite
- [ ] Tester le flow complet d'inscription provider (etape 2 : pays + adresse)
- [ ] Tester la creation/edition de lieu depuis le dashboard pro
- [ ] Ajouter `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` dans Vercel (env vars prod)
- [ ] Securiser la cle API en prod (restriction referrer `opatam.com/*` + quota journalier)

## Moyenne priorite
- [ ] Ajouter le filtre pays dans la page de recherche client (`/recherche`)
- [ ] Adapter le mobile (memes changements que le web : GoogleAddressAutocomplete + CountrySelect)
- [ ] Migration des providers existants : ajouter `countryCode: 'FR'` (script one-shot ou au runtime)

## Basse priorite
- [ ] Supprimer l'API route `/api/google-places/autocomplete` (plus utilisee cote client)
- [ ] Gerer les timezones par pays (Portugal = Europe/Lisbon)
- [ ] Ameliorer l'affichage quand le code postal est vide (trim des espaces)
- [ ] Ajouter le pays dans l'affichage des adresses (LocationCard, BookingRecap, ProviderInfo)
