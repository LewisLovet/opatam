#!/usr/bin/env bash
# Teste les règles Firestore — et le code serveur de l'espace membre, et le
# service des horaires datés —
# contre l'émulateur local.
#   ./firestore/run-rules-test.sh
# Nécessite Java (émulateur Firestore). N'écrit RIEN en production :
# l'émulateur tourne sur un projet jetable.
set -euo pipefail
cd "$(dirname "$0")/.."
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
  npx firebase emulators:exec --only firestore --project opatam-rules-test \
  "node --experimental-strip-types --no-warnings --test --test-concurrency=1 firestore/rules-admin.test.mjs firestore/rules-codes-acces.test.mjs firestore/rules-membres.test.mjs apps/web/lib/espace-membre.emulateur.test.mjs packages/firebase/src/services/horaires-dates.emulateur.test.mjs"
