# Fonctionnalites Client

> Ce document decrit toutes les fonctionnalites disponibles pour les clients (personnes qui reservent des services).

---

## 1. Recherche de prestataires

### Sur le site web
- **Page d'accueil** : barre de recherche avec categories mises en avant
- **Page de recherche** (`/recherche`) : resultats avec filtres par categorie, localisation et disponibilite
- **Profil prestataire** (`/p/[slug]`) : fiche detaillee avec services, tarifs, disponibilites, avis et photos

### Sur l'application mobile
- **Onglet Accueil** : categories de services et prestataires recommandes
- **Onglet Recherche** : recherche par mot-cle, categorie, localisation
- **Filtres disponibles** : categorie, ville, prix, disponibilite
- **Geolocalisation** : recherche de prestataires a proximite (avec autorisation)

### Informations affichees sur un profil prestataire
- Nom de l'entreprise et photo
- Description et categorie d'activite
- Liste des services avec tarifs et durees
- Membres de l'equipe (si plan equipe)
- Lieux d'exercice avec adresses
- Horaires d'ouverture
- Avis clients et note moyenne
- Portfolio photos (jusqu'a 10 photos)
- Liens reseaux sociaux (Instagram, Facebook, TikTok, site web)
- Prochain creneau disponible

---

## 2. Reservation

### Etapes de reservation (detaillees dans 05-PARCOURS-RESERVATION.md)

1. **Choix du service** : selectionner la prestation souhaitee
2. **Choix du membre** (si equipe) : selectionner le professionnel
3. **Choix de la date et du creneau** : visualisation des disponibilites en temps reel
4. **Confirmation** : verifier le recapitulatif et confirmer

### Reservation sans compte (web uniquement)
Sur le site web, il est possible de reserver sans creer de compte. Il suffit de fournir :
- Nom
- Adresse email
- Numero de telephone

Un email de confirmation avec un lien d'annulation est envoye automatiquement.

### Reservation avec compte (mobile et web)
Avec un compte, l'historique des reservations est sauvegarde et accessible a tout moment.

---

## 3. Gestion des rendez-vous

### Consultation
- **Sur mobile** : onglet "Mes RDV" avec les rendez-vous a venir et passes
- **Sur web** : page de confirmation apres reservation, emails avec details

### Detail d'un rendez-vous
Pour chaque rendez-vous, les informations suivantes sont affichees :
- Nom du prestataire et photo
- Nom du membre (si equipe) et photo
- Service reserve (nom, duree, prix)
- Date et heure
- Adresse du lieu
- Statut (en attente, confirme, annule, absent)

### Statuts d'un rendez-vous

| Statut | Signification |
|--------|---------------|
| **En attente** | Le rendez-vous a ete cree mais attend la confirmation du prestataire |
| **Confirme** | Le prestataire a confirme le rendez-vous |
| **Annule** | Le rendez-vous a ete annule (par le client ou le prestataire) |
| **Absent** | Le client ne s'est pas presente au rendez-vous |

### Annulation
- **Depuis l'application mobile** : sur la page de detail du rendez-vous, bouton "Annuler"
- **Depuis le web** : via le lien d'annulation dans l'email de confirmation
- **Raison** : le client peut indiquer une raison d'annulation (optionnel)
- **Notification** : le prestataire est automatiquement prevenu de l'annulation

> **Important** : Les conditions d'annulation (delai minimum) sont definies par chaque prestataire individuellement.

---

## 4. Avis et evaluations

### Laisser un avis
- Apres un rendez-vous termine, le client recoit un email lui proposant de laisser un avis
- L'avis comprend une note (1 a 5 etoiles) et un commentaire optionnel
- Le commentaire est visible uniquement par le prestataire (prive)
- La note en etoiles est publique et contribue a la note moyenne du prestataire
- Delai pour laisser un avis : 14 jours apres le rendez-vous

### Consulter les avis
- Sur la fiche du prestataire : note moyenne, nombre d'avis, distribution des notes
- Les avis sont affiches avec le nom du client et la date

---

## 5. Notifications

### Types de notifications recues par les clients

| Evenement | Notification push | Email |
|-----------|-------------------|-------|
| Reservation creee | - | Oui (confirmation) |
| Reservation confirmee par le prestataire | Oui | Oui |
| Reservation annulee par le prestataire | Oui | Oui |
| Horaire modifie par le prestataire | Oui | Oui |
| Rappel 24h avant le RDV | Oui | Oui |
| Rappel 2h avant le RDV | Oui | Oui |
| Demande d'avis | - | Oui |

### Parametres de notification
Depuis l'application mobile, le client peut configurer ses preferences :
- Activer/desactiver les notifications push
- Activer/desactiver les notifications email
- Activer/desactiver les rappels
- Activer/desactiver les notifications de confirmation
- Activer/desactiver les notifications d'annulation
- Activer/desactiver les notifications de modification d'horaire

---

## 6. Profil utilisateur

### Informations du profil
- Nom complet
- Adresse email
- Numero de telephone
- Photo de profil
- Ville
- Annee de naissance
- Genre

### Actions disponibles
- Modifier les informations du profil
- Modifier les preferences de notification
- Se deconnecter
- Supprimer son compte

---

## 7. Ajout au calendrier

Apres une reservation, il est possible de telecharger un fichier ICS pour ajouter le rendez-vous a son calendrier personnel (Google Calendar, Apple Calendar, Outlook, etc.).
