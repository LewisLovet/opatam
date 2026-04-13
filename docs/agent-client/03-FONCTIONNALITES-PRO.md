# Fonctionnalites Prestataire (Pro)

> Ce document decrit toutes les fonctionnalites disponibles pour les prestataires (professionnels qui proposent des services).

---

## 1. Inscription et demarrage

### Processus d'inscription
1. Creer un compte sur le site web (email, Google ou Apple)
2. Choisir le type de compte "Prestataire"
3. Renseigner les informations de l'entreprise (nom, categorie, description)
4. Configurer les services, lieux et disponibilites
5. Publier son profil pour etre visible des clients

### Essai gratuit
- **Duree** : 30 jours
- **Acces** : complet a toutes les fonctionnalites
- **Sans carte bancaire** : aucun paiement requis pour demarrer
- **Sans engagement** : le profil est automatiquement depublie si pas d'abonnement apres l'essai

---

## 2. Dashboard / Tableau de bord

### Sur le site web (`/pro`)
- Rendez-vous du jour
- Statistiques de base (reservations, vues du profil)
- Acces rapide aux fonctionnalites principales

### Sur l'application mobile (onglet Accueil)
- Apercu des rendez-vous du jour
- Badge indiquant le nombre de reservations en attente
- Acces rapide au calendrier et aux reservations

---

## 3. Gestion des services / prestations

### Creer un service
Chaque service comprend :
- **Nom** : ex. "Coupe homme", "Massage relaxant 1h"
- **Description** (optionnel) : details sur la prestation
- **Photo** (optionnel) : image illustrative
- **Duree** : en minutes (ex. 30, 60, 90)
- **Prix** : en euros (stocke en centimes en interne, ex. 35,00 EUR)
- **Prix maximum** (optionnel) : pour les tarifs variables ("a partir de 35 EUR" / "de 35 a 50 EUR")
- **Temps de battement** : temps de pause apres le RDV (par defaut 15 min)
- **Categorie de service** (optionnel) : regroupement visuel
- **Lieux** : dans quels lieux ce service est propose
- **Membres** (si equipe) : quels membres de l'equipe proposent ce service (si vide = tous)

### Organiser les services
- Ordre personnalisable (drag & drop)
- Activation/desactivation d'un service
- Regroupement par categories

---

## 4. Gestion de l'equipe (Plan Studio)

### Membres de l'equipe
Le plan Studio permet de gerer jusqu'a 10 membres d'equipe. Chaque membre a :
- Nom, email, telephone
- Photo de profil
- Couleur attribuee (pour le calendrier, 10 couleurs disponibles)
- Code d'acces (pour consulter son propre planning)
- Lieu d'exercice attribue
- Statut actif/inactif

### Fonctionnalites equipe
- Ajouter/modifier/desactiver des membres
- Assigner des services specifiques a chaque membre
- Chaque membre peut consulter son propre planning via un code d'acces
- Les clients peuvent choisir un membre specifique lors de la reservation

> **Note** : Les membres d'equipe ne sont pas des utilisateurs de l'application. Ils n'ont pas de compte propre. Seul l'administrateur (proprietaire du compte prestataire) gere l'ensemble.

---

## 5. Gestion des lieux

### Informations d'un lieu
- Nom (ex. "Salon principal", "A domicile")
- Adresse complete (rue, ville, code postal)
- Type : fixe (salon, cabinet) ou mobile (deplacement a domicile)
- Rayon de deplacement (si type mobile)
- Geolocalisation automatique
- Pays (France par defaut, 9 pays europeens supportes)

### Limites
- **Plan Pro** : 1 lieu maximum
- **Plan Studio** : jusqu'a 10 lieux

---

## 6. Gestion des disponibilites

### Horaires recurrents
Pour chaque jour de la semaine, definir les plages horaires d'ouverture :
- Exemple : Lundi 9h-12h, 14h-18h
- Configuration par membre (si equipe) ou globale (si solo)
- Configuration par lieu

### Indisponibilites ponctuelles (Blocked Slots)
- Bloquer une plage horaire specifique (ex. "Lundi 14 avril, 10h-12h")
- Bloquer une journee entiere
- Indiquer une raison (optionnel) : "Vacances", "Formation", etc.
- Applicable a un membre specifique ou a tous

### Parametres de reservation
- **Intervalle des creneaux** : 30 minutes par defaut
- **Delai minimum de reservation** : combien d'heures a l'avance un client doit reserver
- **Delai maximum de reservation** : combien de jours a l'avance un client peut reserver
- **Confirmation manuelle** : si active, chaque reservation doit etre confirmee par le prestataire
- **Annulation par le client** : autoriser ou non les clients a annuler
- **Delai d'annulation** : nombre d'heures minimum avant le RDV pour annuler

---

## 7. Gestion des reservations

### Actions disponibles sur un rendez-vous

| Action | Description |
|--------|-------------|
| **Confirmer** | Valider un rendez-vous en attente |
| **Annuler** | Annuler un rendez-vous (le client est automatiquement prevenu) |
| **Modifier l'horaire** | Deplacer un rendez-vous a une autre date/heure |
| **Marquer absent (No-show)** | Indiquer que le client ne s'est pas presente |

### Calendrier
- **Sur le web** (`/pro/calendrier`) : vue hebdomadaire avec tous les rendez-vous
- **Sur mobile** (onglet Agenda) : vue calendrier avec les rendez-vous du jour et de la semaine
- Couleurs des membres visibles sur le calendrier

### Liste des reservations
- Filtrage par statut, date, membre
- Vue de toutes les reservations passees et a venir

### Creation manuelle
Sur l'application mobile, le prestataire peut creer manuellement un rendez-vous (bouton "+" au centre de la barre de navigation).

---

## 8. Profil public

### Informations du profil
- Nom de l'entreprise
- Description
- Categorie d'activite
- Photo de profil et photo de couverture
- Portfolio photos (jusqu'a 10 images)
- Liens reseaux sociaux (Instagram, Facebook, TikTok, site web)

### URL du profil
Chaque prestataire a une URL unique : `opatam.com/p/[slug]`
Le slug est genere automatiquement a partir du nom de l'entreprise.

### Publication
Le profil doit etre publie pour etre visible des clients. Le profil est automatiquement depublie si :
- L'abonnement expire sans renouvellement
- Le prestataire le depublie manuellement

---

## 9. Avis clients

### Recevoir des avis
- Apres un rendez-vous termine, un email est automatiquement envoye au client pour lui demander un avis
- Delai d'envoi configurable dans les parametres
- Delai maximum pour laisser un avis : 14 jours

### Consulter ses avis
- Note moyenne et distribution des notes (1-5 etoiles)
- Liste des avis recus
- Les commentaires sont visibles uniquement par le prestataire (pas publics)

---

## 10. Notifications pour les prestataires

| Evenement | Notification push | Email |
|-----------|-------------------|-------|
| Nouveau rendez-vous | Oui | Oui |
| Annulation par un client | Oui | Oui |
| Resume quotidien de l'agenda | - | Oui |
| Rappels d'abonnement | Oui | Oui |

### Parametres de notification (prestataire)
- Activer/desactiver les notifications push
- Activer/desactiver les notifications email
- Configurer les types de notifications souhaites (nouveau RDV, confirmations, annulations, rappels)

---

## 11. Statistiques

### Donnees disponibles
- Nombre de vues du profil
- Nombre de reservations
- Tendances dans le temps

---

## 12. Parametres du compte

Accessibles depuis `/pro/parametres` sur le web ou l'onglet "Plus" sur mobile :
- Modifier les informations de l'entreprise
- Gerer l'abonnement
- Configurer les notifications
- Configurer les parametres de reservation
- Supprimer le compte
