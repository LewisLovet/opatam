#!/usr/bin/env bash
# Teste les règles Firestore contre l'émulateur local.
#   ./firestore/run-rules-test.sh
# Nécessite Java (émulateur Firestore). N'écrit RIEN en production :
# l'émulateur tourne sur un projet jetable.
set -euo pipefail
cd "$(dirname "$0")/.."
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
  npx firebase emulators:exec --only firestore --project opatam-rules-test \
  "node --test firestore/rules-admin.test.mjs"
