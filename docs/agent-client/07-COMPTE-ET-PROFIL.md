# Compte et profil

> Ce document decrit la gestion du compte utilisateur, les methodes de connexion et les donnees personnelles.

---

## 1. Creation de compte

### Methodes d'inscription
- **Email et mot de passe** : creation classique avec email et mot de passe
- **Google** : connexion en un clic avec un compte Google
- **Apple** : connexion avec Apple (disponible sur iOS, obligatoire car Google Sign-In est propose)

### Types de comptes

| Type | Description |
|------|-------------|
| **Client** | Peut rechercher des prestataires et reserver des rendez-vous |
| **Prestataire (Provider)** | Peut gerer son entreprise, ses services, son equipe |
| **Les deux (Both)** | Un utilisateur qui est a la fois client et prestataire |

### Processus d'inscription client (mobile)
1. Ecran d'accueil avec options de connexion
2. Onboarding (premiere ouverture uniquement)
3. Choix du type de compte (client ou pro)
4. Si client par email : formulaire avec nom, email, mot de passe, telephone (optionnel)
5. Si client par Google/Apple : les informations sont pre-remplies

### Processus d'inscription prestataire
L'inscription prestataire se fait via le site web. Si un utilisateur mobile choisit "Pro", il est redirige vers le site.

---

## 2. Connexion

### Methodes de connexion
- Email + mot de passe
- Google
- Apple (iOS uniquement)

### Mot de passe oublie
1. Depuis l'ecran de connexion, cliquer sur "Mot de passe oublie"
2. Saisir son adresse email
3. Un email de reinitialisation est envoye
4. Cliquer sur le lien dans l'email pour definir un nouveau mot de passe

### Redirection apres connexion
- **Client** : redirige vers l'onglet Accueil de l'application
- **Prestataire** : redirige vers l'espace Pro (dashboard)

---

## 3. Profil client

### Informations du profil
| Champ | Obligatoire | Modifiable |
|-------|-------------|------------|
| Nom complet | Oui | Oui |
| Email | Oui | Non (lie au compte) |
| Telephone | Non | Oui |
| Photo de profil | Non | Oui |
| Ville | Non | Oui |
| Annee de naissance | Non | Oui |
| Genre | Non | Oui |

### Modification du profil
- **Sur mobile** : Profil > Modifier le profil
- Les modifications sont sauvegardees immediatement

---

## 4. Profil prestataire

### Informations du profil entreprise
| Champ | Obligatoire | Description |
|-------|-------------|-------------|
| Nom de l'entreprise | Oui | Nom affiche publiquement |
| Description | Oui | Presentation de l'activite |
| Categorie | Oui | Secteur d'activite parmi les 15 categories |
| Slug (URL) | Auto | Genere automatiquement depuis le nom |
| Photo de profil | Non | Logo ou photo du prestataire |
| Photo de couverture | Non | Banniere en haut du profil |
| Portfolio | Non | Jusqu'a 10 photos de realisations |
| Instagram | Non | Lien vers le profil Instagram |
| Facebook | Non | Lien vers la page Facebook |
| TikTok | Non | Lien vers le profil TikTok |
| Site web | Non | URL du site internet |

---

## 5. Donnees personnelles et confidentialite

### Donnees collectees
| Donnee | Finalite |
|--------|----------|
| Nom, email, telephone | Identification, communication, reservation |
| Photo de profil | Personnalisation du compte |
| Localisation approximative | Recherche de prestataires a proximite |
| Historique de reservations | Suivi des rendez-vous |
| Push token (appareil) | Envoi de notifications push |

### Sous-traitants
| Service | Donnees | Finalite |
|---------|---------|----------|
| Firebase (Google) | Compte, donnees | Hebergement, authentification |
| Stripe | Paiement (prestataires) | Gestion des abonnements |
| Resend | Email | Envoi d'emails transactionnels |
| Expo (EAS) | Push token | Notifications push |

### Droits des utilisateurs (RGPD)
- **Droit d'acces** : consulter ses donnees depuis son profil
- **Droit de rectification** : modifier ses informations depuis son profil
- **Droit de suppression** : supprimer son compte et toutes ses donnees
- **Droit a la portabilite** : contacter support@kamerleontech.com

### Suppression de compte
- **Sur mobile** : Profil > Parametres > Supprimer le compte
- La suppression est definitive et irrecuperable
- Toutes les donnees personnelles sont supprimees
- Les reservations passees sont anonymisees
- Conforme aux guidelines Apple (Guideline 5.1.1(v))

---

## 6. Securite

### Authentification
- Mots de passe geres par Firebase Authentication (Google)
- Connexion sociale securisee via OAuth (Google, Apple)
- Sessions persistantes avec rafraichissement automatique

### Protection des donnees
- Communications chiffrees (HTTPS/TLS)
- Base de donnees avec regles de securite strictes :
  - Un utilisateur ne peut lire/modifier que ses propres donnees
  - Les profils prestataires sont lisibles publiquement (profils publies)
  - Les reservations sont accessibles uniquement par les participants

---

## 7. Pages legales

Les pages legales sont disponibles sur le site web :
- **Politique de confidentialite** : opatam.com/confidentialite
- **Conditions generales d'utilisation** : opatam.com/cgu
- **Conditions generales de vente** : opatam.com/cgv
- **Mentions legales** : opatam.com/mentions-legales
