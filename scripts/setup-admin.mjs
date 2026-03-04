/**
 * Script de configuration admin Opatam
 *
 * Usage :
 *   node scripts/setup-admin.mjs
 *
 * Ce script explique comment configurer un compte admin.
 * Chaque admin a son propre code confidentiel, créé à la première connexion.
 */

console.log(`
🔧 Configuration Admin Opatam
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Pour ajouter un admin, une seule étape dans Firebase Console :

1. Va dans Firestore Database
2. Collection "users" → trouve le document de l'utilisateur
3. Ajoute le champ : isAdmin = true (type: boolean)

C'est tout ! 🎉

Lors de sa première connexion au dashboard admin,
l'utilisateur devra créer son code confidentiel personnel.
Ce code sera demandé à chaque nouvelle session navigateur.

Chaque admin peut ensuite modifier son code depuis
le dashboard via le bouton "Modifier le code" dans la sidebar.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
