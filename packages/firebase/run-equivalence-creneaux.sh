#!/usr/bin/env bash
#
# Équivalence du moteur de créneaux — à lancer AVANT et APRÈS toute
# modification de `generateTimeSlots` ou de la boucle de jours.
#
# Règle maison sur ce moteur : on ne le modifie pas sans prouver ce qu'on a
# changé. Ce script fige le comportement du serveur web, qui tourne en
# Europe/Paris (`apps/web/next.config.ts`) — d'où le `TZ` imposé : un test
# qui s'adapterait au fuseau de la machine ne prouverait rien.
#
#   ./packages/firebase/run-equivalence-creneaux.sh
#
# PARTIE 1 doit rester verte quoi qu'il arrive : ce sont les journées
# ordinaires, et elles ont traversé l'étape 3 sans bouger d'un millième.
# PARTIE 2 fige ce que l'étape 3 a corrigé sur les jours de bascule, avec
# l'état d'avant en commentaire.
#
# Les cas de BOUCLE portent sur des dates futures, parce que le moteur
# filtre le passé (préavis minimum). Quand elles seront dépassées, le test
# le dira explicitement : décaler les dates, recapturer, remplacer.

set -euo pipefail

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$RACINE"

echo "→ Moteur de créneaux, équivalence (TZ=Europe/Paris)"
TZ=Europe/Paris npx tsx --test packages/firebase/src/services/scheduling.equivalence.test.ts
