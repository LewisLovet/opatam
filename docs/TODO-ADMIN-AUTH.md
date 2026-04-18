# TODO — Sécuriser l'authentification des routes admin

## Problème actuel

Toutes les routes `/api/admin/*` s'authentifient via un header `x-admin-uid`
contenant l'UID Firebase de l'admin. Le serveur vérifie uniquement que cet
UID existe dans `users` avec `isAdmin === true`. **Il ne vérifie PAS que
l'appelant est bien cet utilisateur.**

Quiconque connaît l'UID d'un admin peut donc appeler tous ces endpoints.

L'UID Firebase n'est pas un secret — il est visible en console navigateur,
dans les logs, les screenshots, etc. Et il ne peut pas être rotate sans
supprimer le compte.

## Routes à migrer

- [ ] `/api/admin/affiliates/route.ts`
- [ ] `/api/admin/affiliates/[affiliateId]/route.ts`
- [ ] `/api/admin/providers/route.ts`
- [ ] `/api/admin/providers/[id]/...`
- [ ] `/api/admin/reviews/route.ts`
- [ ] `/api/admin/reviews/[reviewId]/route.ts`
- [ ] `/api/admin/users/route.ts`
- [ ] `/api/admin/stats/route.ts`
- [ ] `/api/admin/bookings/route.ts`
- [ ] `/api/admin/change-code/route.ts`
- [ ] `/api/admin/verify-code/route.ts`
- [ ] `/api/admin/recalculate-ratings/route.ts`

## Plan de migration

### Backend
1. Créer un helper partagé `lib/admin-auth.ts` qui :
   - Lit `Authorization: Bearer <token>` du header
   - Appelle `admin.auth().verifyIdToken(token)` pour vérifier la signature
   - Extrait l'UID du token vérifié
   - Check que `users/{uid}.isAdmin === true`
   - Retourne `{ ok: true, uid }` ou `{ ok: false, status, error }`
2. Remplacer `verifyAdmin(request.headers.get('x-admin-uid'))` par ce helper
   dans toutes les routes listées ci-dessus.

### Frontend
3. Modifier `apps/web/services/admin/*` pour envoyer
   `Authorization: Bearer ${await user.getIdToken()}` à la place du header
   `x-admin-uid`.
4. Gérer le refresh du token si l'appel revient en 401 (le SDK le fait
   automatiquement via `getIdToken(true)`).

## Estimation
~1-2h pour les deux côtés.

## À faire avant
- Vérifier qu'il n'y a pas d'autre consommateur non-web des routes admin
  (script, CI, curl manuel) qui serait cassé par le changement.
