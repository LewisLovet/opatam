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
# PARTIE 1 doit rester verte quoi qu'il arrive.
# PARTIE 2 fige des anomalies CONNUES des jours de bascule : quand l'étape 3
# du chantier fuseaux les corrigera, ces tests-là échoueront — c'est le
# signal attendu, et leurs attentes devront être remplacées par la cible
# écrite en commentaire à côté de chacune.

set -euo pipefail

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$RACINE"

echo "→ Moteur de créneaux, équivalence (TZ=Europe/Paris)"
TZ=Europe/Paris npx tsx --test packages/firebase/src/services/scheduling.equivalence.test.ts
