#!/usr/bin/env bash
# i18n-leaks.sh — détecteur de chaînes françaises EN DUR dans le code source.
#
# Usage :
#   ./scripts/i18n-leaks.sh apps/web/app/HomePage.tsx apps/web/components/home ...
#
# Pourquoi un scan SOURCE et pas seulement un scan de la page rendue :
# un scan runtime ne voit que ce qui est À L'ÉCRAN. Les modales, états
# d'erreur, toasts, branches conditionnelles n'apparaissent pas — c'est
# exactement comme ça que des sections ont été oubliées lors du pilote
# i18n de la page d'accueil. Le scan source voit TOUTES les branches.
#
# Heuristique : lettres accentuées françaises dans des littéraux de chaîne
# ou du texte JSX, hors lignes de commentaire (le code du repo est commenté
# en français — voulu, ça ne fuit pas à l'écran). Zéro sortie = propre.

set -euo pipefail

if [ $# -eq 0 ]; then
  echo "Usage: $0 <fichier-ou-dossier> [...]" >&2
  exit 2
fi

python3 - "$@" << 'PYEOF'
import os, re, sys

ACCENTS = 'éèêëàâçùûîïôœÉÈÀÂÇÙÛÎÏÔŒ'
# Une "fuite" = accent dans un littéral '...' ou "..." ou `...`,
# ou dans du texte JSX (entre > et <). Les commentaires sont ignorés.
IN_STRING = re.compile(r"'[^']*[%s][^']*'|\"[^\"]*[%s][^\"]*\"|`[^`]*[%s][^`]*`" % (ACCENTS, ACCENTS, ACCENTS))
IN_JSX_TEXT = re.compile(r'>[^<>{}]*[%s]' % ACCENTS)
COMMENT_LINE = re.compile(r'^\s*(//|\*|/\*|\{\s*/\*)')

def scan_file(path):
    hits = []
    try:
        lines = open(path, encoding='utf-8').read().splitlines()
    except (UnicodeDecodeError, OSError):
        return hits
    for n, line in enumerate(lines, 1):
        if COMMENT_LINE.match(line):
            continue
        # coupe le commentaire de fin de ligne pour ne pas le matcher
        code = re.split(r'\s//\s', line)[0]
        if IN_STRING.search(code) or IN_JSX_TEXT.search(code):
            hits.append((n, line.strip()))
    return hits

found = False
for target in sys.argv[1:]:
    files = []
    if os.path.isfile(target):
        files = [target]
    else:
        for root, _, names in os.walk(target):
            files += [os.path.join(root, f) for f in names if f.endswith(('.tsx', '.ts'))]
    for f in sorted(files):
        for n, line in scan_file(f):
            print(f'{f}:{n}: {line[:140]}')
            found = True

if not found:
    print('✓ Aucune chaîne française en dur détectée.')
else:
    print('\n⚠ Chaînes ci-dessus à extraire vers packages/i18n (ou faux positifs à vérifier).', file=sys.stderr)
    sys.exit(1)
PYEOF
