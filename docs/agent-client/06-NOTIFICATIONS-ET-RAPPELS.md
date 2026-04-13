# Notifications et rappels

> Ce document decrit le systeme complet de notifications d'Opatam.

---

## 1. Canaux de notification

Opatam utilise deux canaux de notification :
- **Notifications push** : envoyees sur le telephone via l'application mobile
- **Emails** : envoyes a l'adresse email du client ou du prestataire

---

## 2. Notifications pour les clients

### Evenements et canaux

| Evenement | Push | Email | Condition |
|-----------|------|-------|-----------|
| Reservation creee | - | Oui | Toujours |
| Reservation confirmee par le prestataire | Oui | Oui | Si preferences activees |
| Reservation annulee par le prestataire | Oui | Oui | Si preferences activees |
| Horaire modifie (reschedule) | Oui | Oui | Si preferences activees |
| Rappel 24h avant le RDV | Oui | Oui | Si rappels actives |
| Rappel 2h avant le RDV | Oui | Oui | Si rappels actives |
| Demande d'avis apres le RDV | - | Oui | Toujours |

### Preferences de notification (client)
Les clients peuvent configurer leurs preferences depuis l'application mobile (`Profil > Parametres de notification`) :

| Parametre | Par defaut |
|-----------|------------|
| Notifications push | Active |
| Notifications email | Active |
| Rappels | Active |
| Confirmations | Active |
| Annulations | Active |
| Modifications d'horaire | Active |

### Comment desactiver les notifications push
- **Dans l'application** : Profil > Parametres de notification
- **Via iOS** : Reglages > Notifications > Opatam

---

## 3. Notifications pour les prestataires

### Evenements et canaux

| Evenement | Push | Email |
|-----------|------|-------|
| Nouveau rendez-vous recu | Oui | Oui |
| Annulation par un client | Oui | Oui |
| Resume quotidien de l'agenda | - | Oui |
| Rappels d'abonnement (essai, expiration) | Oui | Oui |

### Preferences de notification (prestataire)
Configurables depuis les parametres du compte :
- Notifications push activees/desactivees
- Notifications email activees/desactivees
- Types specifiques : nouveau RDV, confirmations, annulations, rappels

---

## 4. Systeme de rappels

### Fonctionnement
Le systeme de rappels fonctionne automatiquement :
- Un processus tourne **toutes les heures**
- Il identifie les rendez-vous confirmes dans les 25 prochaines heures
- Il envoie les rappels aux clients concernes

### Types de rappels

| Rappel | Declenchement | Contenu |
|--------|---------------|---------|
| **Rappel 24h** | Quand le RDV est dans 3 a 25 heures | "Votre rendez-vous demain a [heure] chez [prestataire]" |
| **Rappel 2h** | Quand le RDV est dans moins de 3 heures | "Votre rendez-vous dans 2h chez [prestataire]" |

### Regles de deduplication
- **Un seul rappel par rendez-vous** : si un rappel a deja ete envoye, il ne sera pas renvoye
- Les rappels envoyes sont traces dans le systeme

### Heures calmes
- **Aucun rappel envoye entre 23h et 6h** (heure de Paris)
- Les rappels sont decales au prochain cycle apres 6h

---

## 5. Contenu des emails

### Email de confirmation de reservation
- Nom du prestataire
- Service reserve (nom, duree, prix)
- Date et heure du rendez-vous
- Adresse du lieu
- Nom du membre (si equipe)
- Lien d'annulation

### Email d'annulation
- Confirmation de l'annulation
- Details du rendez-vous annule
- Raison de l'annulation (si fournie)

### Email de modification d'horaire
- Ancien horaire
- Nouvel horaire
- Details du rendez-vous

### Email de rappel
- Details du rendez-vous
- Date et heure
- Adresse du lieu

### Email de demande d'avis
- Details du rendez-vous passe
- Lien pour laisser un avis
- Delai : envoye apres la fin du rendez-vous

---

## 6. Resume quotidien (prestataires)

Les prestataires recoivent un email resume de leur agenda du jour, incluant :
- Liste des rendez-vous de la journee
- Details de chaque rendez-vous (client, service, heure, lieu)

---

## 7. Expediteur des emails

Tous les emails sont envoyes depuis :
- **Expediteur** : Opatam <noreply@kamerleontech.com>
- **Repondre a** : support@kamerleontech.com

> Si un client ne recoit pas les emails, verifier les dossiers spam/indesirables.
