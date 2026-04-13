# FAQ Prestataire (Pro)

> Questions frequentes des prestataires qui utilisent Opatam pour gerer leurs reservations.

---

## Inscription et demarrage

### Q : Comment m'inscrire en tant que prestataire ?
**R** : Rendez-vous sur opatam.com, creez un compte et choisissez le profil "Prestataire". Vous aurez immediatement acces a 30 jours d'essai gratuit, sans carte bancaire.

### Q : Combien de temps dure l'essai gratuit ?
**R** : L'essai gratuit dure **30 jours** avec un acces complet a toutes les fonctionnalites. Aucune carte bancaire n'est requise. Pendant l'essai, les clients peuvent reellement reserver chez vous.

### Q : Que se passe-t-il a la fin de l'essai ?
**R** : Si vous ne souscrivez pas a un abonnement, votre profil sera automatiquement depublie (invisible pour les clients). Vos donnees (services, disponibilites, etc.) sont conservees. Vous pouvez vous abonner a tout moment pour reactiver votre profil.

### Q : Combien de temps faut-il pour configurer mon compte ?
**R** : En moyenne, 5 a 10 minutes. Il suffit de :
1. Renseigner les informations de votre entreprise
2. Ajouter vos services (nom, duree, prix)
3. Definir vos horaires
4. Publier votre profil

---

## Tarifs et abonnement

### Q : Combien coute Opatam ?
**R** : Deux plans sont disponibles :
- **Plan Pro** (independants) : 19,90 EUR/mois ou 199 EUR/an
- **Plan Studio** (equipes) : 29,90 EUR/mois ou 299 EUR/an
Aucune commission sur les reservations.

### Q : Y a-t-il des commissions sur mes reservations ?
**R** : Non, **0% de commission**. Que vous receviez 1 ou 100 reservations par mois, vous payez uniquement votre abonnement mensuel ou annuel.

### Q : Puis-je changer de plan ?
**R** : Oui, vous pouvez passer du plan Pro au plan Studio (ou l'inverse) a tout moment depuis vos parametres de compte.

### Q : Comment payer mon abonnement ?
**R** : Par carte bancaire (Visa, Mastercard, etc.) via Stripe. Le paiement est securise et automatiquement renouvele.

### Q : Comment annuler mon abonnement ?
**R** : Depuis vos parametres de compte, acces au portail de facturation Stripe. L'annulation est immediate et sans frais. Votre abonnement reste actif jusqu'a la fin de la periode deja payee.

### Q : Que se passe-t-il si mon paiement echoue ?
**R** : Stripe retente automatiquement le paiement. Si le paiement echoue definitivement, votre profil sera depublie mais vos donnees seront conservees. Vous pourrez mettre a jour vos informations de paiement pour reactiver votre compte.

---

## Services et prestations

### Q : Comment ajouter un service ?
**R** : Depuis le site web : allez dans `/pro/activite` (Services). Cliquez sur "Ajouter un service" et renseignez : nom, description, duree, prix, temps de battement. Sur mobile : onglet Plus > Services.

### Q : Puis-je definir des tarifs variables (ex. "a partir de 35 EUR") ?
**R** : Oui, lors de la creation d'un service, vous pouvez definir un prix minimum et un prix maximum. Le client verra "A partir de 35 EUR" ou "De 35 a 50 EUR".

### Q : Comment organiser mes services par categories ?
**R** : Vous pouvez creer des categories de services (ex. "Coupes", "Colorations", "Soins") pour regrouper vos prestations visuellement.

### Q : Puis-je desactiver temporairement un service ?
**R** : Oui, chaque service peut etre active ou desactive. Un service desactive n'apparait plus dans votre vitrine publique mais n'est pas supprime.

---

## Equipe et membres (Plan Studio)

### Q : Combien de membres puis-je ajouter ?
**R** : Le plan Studio permet jusqu'a **10 membres** d'equipe.

### Q : Les membres de mon equipe ont-ils acces a l'application ?
**R** : Les membres n'ont pas de compte propre sur Opatam. Seul l'administrateur (vous) gere l'ensemble. Cependant, chaque membre recoit un **code d'acces** qui lui permet de consulter son propre planning via une page web dediee.

### Q : Puis-je assigner des services specifiques a chaque membre ?
**R** : Oui, lors de la creation ou modification d'un service, vous pouvez selectionner quels membres de l'equipe le proposent. Si aucun membre n'est selectionne, le service est propose par tous.

### Q : Comment les clients choisissent-ils un membre ?
**R** : Lors de la reservation, le client voit la liste des membres disponibles pour le service choisi. Il peut choisir un membre specifique ou selectionner "Peu importe".

---

## Disponibilites et horaires

### Q : Comment definir mes horaires ?
**R** : Depuis le site web (`/pro/availability`) ou l'application mobile (onglet Plus > Disponibilites). Definissez vos plages horaires pour chaque jour de la semaine. Vous pouvez avoir plusieurs plages par jour (ex. 9h-12h, 14h-18h).

### Q : Comment bloquer une periode (vacances, absence) ?
**R** : Depuis les disponibilites, ajoutez une "indisponibilite". Vous pouvez bloquer une plage horaire specifique ou une journee entiere. Indiquez une raison (optionnel) comme "Vacances" ou "Formation".

### Q : Quel est l'intervalle entre les creneaux ?
**R** : Par defaut, les creneaux sont proposes toutes les 30 minutes. Ce parametre est configurable.

### Q : Comment fonctionne le temps de battement ?
**R** : Le temps de battement est une pause automatique apres chaque rendez-vous (par defaut 15 minutes). Par exemple, si un RDV de 60 minutes commence a 10h00, le prochain creneau disponible sera a 11h15 (10h00 + 60min de prestation + 15min de battement).

---

## Reservations

### Q : Comment confirmer un rendez-vous ?
**R** : Si la confirmation manuelle est activee, les nouveaux rendez-vous apparaissent avec le statut "En attente". Depuis le calendrier ou la liste des reservations, ouvrez le rendez-vous et cliquez sur "Confirmer".

### Q : Puis-je desactiver la confirmation manuelle ?
**R** : Oui, dans les parametres de reservation. Les rendez-vous seront alors automatiquement confirmes.

### Q : Comment modifier l'horaire d'un rendez-vous ?
**R** : Ouvrez le detail du rendez-vous et utilisez la fonction "Modifier l'horaire". Choisissez une nouvelle date et heure. Le client sera automatiquement notifie du changement.

### Q : Que signifie "Marquer absent" (No-show) ?
**R** : Si un client ne se presente pas a son rendez-vous, vous pouvez le marquer comme "Absent". Cela incremente son compteur d'absences et vous aide a identifier les clients peu fiables.

### Q : Puis-je creer manuellement un rendez-vous ?
**R** : Oui, sur l'application mobile, utilisez le bouton "+" au centre de la barre de navigation pour creer un rendez-vous manuellement (ex. pour un client qui appelle par telephone).

---

## Profil public

### Q : Comment rendre mon profil visible aux clients ?
**R** : Depuis les parametres, publiez votre profil. Il sera alors accessible a l'adresse `opatam.com/p/votre-nom-entreprise` et apparaitra dans les resultats de recherche.

### Q : Quelle est l'URL de mon profil ?
**R** : Votre profil est accessible a l'adresse `opatam.com/p/[slug]`, ou le slug est genere automatiquement a partir du nom de votre entreprise (en minuscules, sans accents, avec des tirets).

### Q : Combien de photos puis-je ajouter a mon portfolio ?
**R** : Vous pouvez ajouter jusqu'a **10 photos** dans votre portfolio.

---

## Avis

### Q : Comment sont collectes les avis ?
**R** : Apres chaque rendez-vous termine, un email est automatiquement envoye au client pour lui proposer de laisser un avis. Le client a 14 jours pour repondre.

### Q : Les commentaires sont-ils publics ?
**R** : Non, les commentaires ecrits sont **prives** (visibles uniquement par vous). Seule la note en etoiles est publique et contribue a votre note moyenne.

---

## Notifications

### Q : Suis-je prevenu quand un client reserve ?
**R** : Oui, vous recevez une notification push et un email immediatement quand un client fait une reservation.

### Q : Suis-je prevenu quand un client annule ?
**R** : Oui, vous recevez une notification push et un email en cas d'annulation.

### Q : Qu'est-ce que le resume quotidien ?
**R** : Chaque matin, vous recevez un email recapitulant tous vos rendez-vous de la journee.

---

## Multi-lieux

### Q : Puis-je exercer dans plusieurs lieux ?
**R** : Oui, avec le plan Studio, vous pouvez ajouter jusqu'a **10 lieux** differents. Chaque lieu a ses propres horaires et services.

### Q : Quels types de lieux sont supportes ?
**R** : Deux types :
- **Fixe** : salon, cabinet, bureau (adresse fixe)
- **Mobile** : deplacement a domicile (avec rayon de deplacement)

---

## Problemes et support

### Q : Mon profil n'apparait pas dans les resultats de recherche
**R** : Verifiez que :
1. Votre profil est publie (parametres > publier)
2. Votre abonnement est actif (ou essai en cours)
3. Vous avez au moins un service actif
4. Vous avez defini des disponibilites

### Q : Un client me dit qu'il n'a pas recu de confirmation
**R** : L'email peut etre dans les spams. Suggerez au client de verifier le dossier indesirables et d'ajouter noreply@kamerleontech.com a ses contacts.

### Q : J'ai un probleme technique
**R** : Contactez-nous a contact@opatam.com avec une description du probleme. Nous repondons sous 24-48h.
