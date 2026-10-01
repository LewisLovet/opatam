#!/usr/bin/env bash
# Teste le code compilé des functions contre l'émulateur Firestore local.
#   npm --prefix functions run build && ./firestore/run-functions-test.sh
# Nécessite Java (émulateur Firestore). N'écrit RIEN en production :
# l'émulateur tourne sur un projet jetable.
set -euo pipefail
cd "$(dirname "$0")/.."
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
  npx firebase emulators:exec --only firestore --project opatam-functions-test \
  "node --test --test-concurrency=1 functions/src/utils/calculateNextAvailableSlot.emulator.test.mjs functions/src/utils/prochaineDispo-horaires.emulator.test.mjs functions/src/scheduled/rappelPlanning.emulator.test.mjs"
