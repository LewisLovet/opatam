# Parcours de reservation

> Ce document decrit en detail les etapes de reservation, sur le site web et sur l'application mobile.

---

## 1. Reservation sur le site web (sans compte)

### Etape 1 : Trouver un prestataire
- Depuis la page d'accueil (`opatam.com`), utiliser la barre de recherche
- Ou naviguer par categorie
- Ou acceder directement au profil d'un prestataire via son URL (`opatam.com/p/nom-du-prestataire`)

### Etape 2 : Consulter le profil
Sur la fiche du prestataire :
- Voir les services proposes avec les tarifs et durees
- Voir les membres de l'equipe (si applicable)
- Voir les lieux d'exercice
- Consulter les avis d'autres clients
- Voir le prochain creneau disponible

### Etape 3 : Choisir un service
- Cliquer sur le service souhaite
- Si le prestataire a une equipe, choisir un membre (ou "Peu importe" pour le premier disponible)

### Etape 4 : Choisir la date et l'heure
- Un calendrier affiche les jours disponibles
- Pour chaque jour, les creneaux horaires libres sont affiches
- Les creneaux sont calcules en temps reel en tenant compte :
  - Des horaires d'ouverture du prestataire
  - Des reservations existantes
  - Des indisponibilites ponctuelles (vacances, etc.)
  - Du temps de battement entre les rendez-vous
  - De la duree du service choisi

### Etape 5 : Renseigner ses coordonnees
Sans compte, le client doit fournir :
- **Nom complet** (obligatoire)
- **Adresse email** (obligatoire)
- **Numero de telephone** (obligatoire)

### Etape 6 : Confirmer la reservation
- Recapitulatif affiche : service, prestataire, membre, date, heure, lieu, prix
- Cliquer sur "Confirmer la reservation"

### Etape 7 : Confirmation
- Page de confirmation affichee avec tous les details
- Email de confirmation envoye automatiquement
- L'email contient un **lien d'annulation** (valable tant que le RDV n'est pas passe)

---

## 2. Reservation sur l'application mobile (avec compte)

### Etape 1 : Trouver un prestataire
- **Onglet Accueil** : prestataires recommandes et categories
- **Onglet Recherche** : recherche par mot-cle, categorie, ville
- **Geolocalisation** : prestataires a proximite (si autorise)

### Etape 2 : Consulter le profil
- Taper sur un prestataire pour voir sa fiche complete
- Memes informations que sur le web : services, equipe, lieux, avis, portfolio

### Etape 3 : Lancer la reservation
- Taper sur "Reserver" ou sur un service specifique

### Etape 4 : Choisir le membre (si equipe)
- Liste des membres disponibles pour le service choisi
- Option "Peu importe" pour le premier disponible

### Etape 5 : Choisir la date
- Bande calendrier horizontale pour selectionner le jour
- Les creneaux disponibles s'affichent en dessous
- Creneaux calcules en temps reel

### Etape 6 : Confirmer
- Recapitulatif complet affiche
- Bouton "Confirmer la reservation"

### Etape 7 : Confirmation
- Ecran de confirmation
- Notification push de confirmation (si le prestataire confirme automatiquement)
- Le RDV apparait dans l'onglet "Mes RDV"

---

## 3. Apres la reservation

### Statut initial
- Si le prestataire a active la **confirmation manuelle** : statut "En attente" jusqu'a ce que le prestataire confirme
- Si la confirmation est automatique : statut "Confirme" immediatement

### Notifications recues
1. **Email de confirmation** : immediatement apres la reservation
2. **Notification push de confirmation** : quand le prestataire confirme (si applicable)
3. **Rappel 24h avant** : notification push + email (sauf entre 23h et 6h, heures calmes)
4. **Rappel 2h avant** : notification push + email (sauf heures calmes)

### Annulation par le client
- **Sur mobile** : page de detail du RDV > bouton "Annuler"
- **Sur web** : clic sur le lien d'annulation dans l'email de confirmation (URL : `/reservation/annuler/[token]`)
- Le prestataire est automatiquement notifie
- Des conditions d'annulation peuvent s'appliquer selon les parametres du prestataire (delai minimum avant le RDV)

### Modification d'horaire
- Seul le prestataire peut modifier l'horaire d'un rendez-vous
- Le client est automatiquement prevenu par notification push et email
- La notification indique l'ancien et le nouvel horaire

---

## 4. Calcul des creneaux disponibles

Les creneaux proposes au client sont calcules dynamiquement en fonction de :
- **Horaires d'ouverture** : definis par le prestataire pour chaque jour de la semaine
- **Reservations existantes** : les creneaux deja reserves sont exclus
- **Indisponibilites** : les periodes bloquees par le prestataire (vacances, absences, etc.)
- **Duree du service** : le creneau doit etre assez long pour la prestation choisie
- **Temps de battement** : temps de pause entre deux rendez-vous (par defaut 15 minutes)
- **Intervalle** : les creneaux sont proposes toutes les 30 minutes par defaut

---

## 5. Ajout au calendrier

Apres une reservation, un fichier ICS est disponible pour ajouter le rendez-vous au calendrier personnel du client. Ce fichier est compatible avec :
- Google Calendar
- Apple Calendar (iCal)
- Microsoft Outlook
- Tout autre calendrier supportant le format ICS
