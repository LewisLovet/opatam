/**
 * Thèmes de couleur des pages prestataires.
 *
 * FICHIER GÉNÉRÉ — ne pas éditer à la main.
 * Source : scripts de génération, gammes validées le 2026-08-17.
 *
 * Valeurs en CANAUX RVB séparés par des espaces, jamais en hexadécimal : les
 * jetons sont déclarés `rgb(var(--color-primary-N) / <alpha-value>)` dans
 * tailwind.config.ts, et un hex y casserait tous les modificateurs d'opacité
 * — `bg-primary-900/20` en tête, ce qui rend le mode sombre illisible.
 *
 * RÈGLE DE CONCEPTION : la couleur est un ACCENT. Boutons, pastilles, états
 * actifs, liens. Jamais un fond de page, jamais le texte courant. C'est cette
 * contrainte qui rend vingt-trois gammes tenables sans revoir chaque écran.
 */

export const THEME_FAMILIES = [
  { id: 'neutral', label: "Noirs, gris et neutres" },
  { id: 'blue', label: "Bleus" },
  { id: 'green', label: "Verts" },
  { id: 'warm', label: "Chauds" },
  { id: 'red', label: "Rouges et roses" },
  { id: 'purple', label: "Violets" },
] as const;

export type ThemeFamilyId = (typeof THEME_FAMILIES)[number]['id'];

export interface ProviderTheme {
  id: string;
  /** Nom montré au professionnel. Jamais traduit : ce sont des noms de couleur. */
  label: string;
  family: ThemeFamilyId;
  /** Onze nuances, du 50 au 950, en canaux RVB. */
  ramp: readonly string[];
  /**
   * Nuances redéfinies en mode sombre. Présent uniquement sur les gammes
   * assez foncées pour que leur aplat se confonde avec le fond de page.
   */
  rampDark?: Readonly<Record<number, string>>;
}

export const PROVIDER_THEMES: readonly ProviderTheme[] = [
  {
    id: 'noir',
    label: "Noir",
    family: 'neutral',
    ramp: [
      '246 246 246', // 50 — #f6f6f6
      '233 233 233', // 100 — #e9e9e9
      '212 212 212', // 200 — #d4d4d4
      '176 176 176', // 300 — #b0b0b0
      '125 125 125', // 400 — #7d7d7d
      '69 69 69', // 500 — #454545
      '31 31 31', // 600 — #1f1f1f
      '23 23 23', // 700 — #171717
      '16 16 16', // 800 — #101010
      '10 10 10', // 900 — #0a0a0a
      '0 0 0', // 950 — #000000
    ],
    // Aplat trop proche du fond de page en mode sombre. Valeurs
    // dessinees a la main : assez claires pour decoller du fond,
    // assez sombres pour rester lues comme du noir.
    rampDark: {
      500: '58 58 58', // #3a3a3a
      600: '43 43 43', // #2b2b2b
      700: '31 31 31', // #1f1f1f
    },
  },
  {
    id: 'anthracite',
    label: "Anthracite",
    family: 'neutral',
    ramp: [
      '246 247 248', // 50 — #f6f7f8
      '234 236 238', // 100 — #eaecee
      '211 215 219', // 200 — #d3d7db
      '174 181 188', // 300 — #aeb5bc
      '125 135 145', // 400 — #7d8791
      '90 99 109', // 500 — #5a636d
      '60 68 77', // 600 — #3c444d
      '47 54 61', // 700 — #2f363d
      '38 44 50', // 800 — #262c32
      '32 37 42', // 900 — #20252a
      '18 21 24', // 950 — #121518
    ],
  },
  {
    id: 'ardoise',
    label: "Ardoise",
    family: 'neutral',
    ramp: [
      '248 250 252', // 50 — #f8fafc
      '241 245 249', // 100 — #f1f5f9
      '226 232 240', // 200 — #e2e8f0
      '203 213 225', // 300 — #cbd5e1
      '148 163 184', // 400 — #94a3b8
      '100 116 139', // 500 — #64748b
      '71 85 105', // 600 — #475569
      '51 65 85', // 700 — #334155
      '30 41 59', // 800 — #1e293b
      '15 23 42', // 900 — #0f172a
      '2 6 23', // 950 — #020617
    ],
  },
  {
    id: 'taupe',
    label: "Taupe",
    family: 'neutral',
    ramp: [
      '250 248 245', // 50 — #faf8f5
      '242 237 230', // 100 — #f2ede6
      '228 217 203', // 200 — #e4d9cb
      '207 189 166', // 300 — #cfbda6
      '182 156 125', // 400 — #b69c7d
      '160 132 97', // 500 — #a08461
      '138 109 79', // 600 — #8a6d4f
      '112 87 66', // 700 — #705742
      '92 72 58', // 800 — #5c483a
      '76 61 50', // 900 — #4c3d32
      '41 32 26', // 950 — #29201a
    ],
  },
  {
    id: 'nude',
    label: "Nude",
    family: 'neutral',
    ramp: [
      '253 248 245', // 50 — #fdf8f5
      '249 236 229', // 100 — #f9ece5
      '240 215 201', // 200 — #f0d7c9
      '227 187 165', // 300 — #e3bba5
      '208 153 124', // 400 — #d0997c
      '189 125 94', // 500 — #bd7d5e
      '164 102 75', // 600 — #a4664b
      '134 82 62', // 700 — #86523e
      '110 69 54', // 800 — #6e4536
      '92 59 48', // 900 — #5c3b30
      '49 29 23', // 950 — #311d17
    ],
  },
  {
    id: 'bleu',
    label: "Bleu Opatam",
    family: 'blue',
    ramp: [
      '239 246 255', // 50 — #eff6ff
      '219 234 254', // 100 — #dbeafe
      '191 219 254', // 200 — #bfdbfe
      '147 197 253', // 300 — #93c5fd
      '96 165 250', // 400 — #60a5fa
      '59 130 246', // 500 — #3b82f6
      '37 99 235', // 600 — #2563eb
      '29 78 216', // 700 — #1d4ed8
      '30 64 175', // 800 — #1e40af
      '30 58 138', // 900 — #1e3a8a
      '23 37 84', // 950 — #172554
    ],
  },
  {
    id: 'marine',
    label: "Bleu marine",
    family: 'blue',
    ramp: [
      '241 244 249', // 50 — #f1f4f9
      '224 231 242', // 100 — #e0e7f2
      '195 208 229', // 200 — #c3d0e5
      '151 174 210', // 300 — #97aed2
      '102 133 184', // 400 — #6685b8
      '69 101 159', // 500 — #45659f
      '47 75 128', // 600 — #2f4b80
      '38 60 104', // 700 — #263c68
      '34 51 87', // 800 — #223357
      '31 44 74', // 900 — #1f2c4a
      '19 26 46', // 950 — #131a2e
    ],
  },
  {
    id: 'ocean',
    label: "Océan",
    family: 'blue',
    ramp: [
      '240 253 250', // 50 — #f0fdfa
      '204 251 241', // 100 — #ccfbf1
      '153 246 228', // 200 — #99f6e4
      '94 234 212', // 300 — #5eead4
      '45 212 191', // 400 — #2dd4bf
      '20 184 166', // 500 — #14b8a6
      '13 148 136', // 600 — #0d9488
      '15 118 110', // 700 — #0f766e
      '17 94 89', // 800 — #115e59
      '19 78 74', // 900 — #134e4a
      '4 47 46', // 950 — #042f2e
    ],
  },
  {
    id: 'emeraude',
    label: "Émeraude",
    family: 'green',
    ramp: [
      '236 253 245', // 50 — #ecfdf5
      '209 250 229', // 100 — #d1fae5
      '167 243 208', // 200 — #a7f3d0
      '110 231 183', // 300 — #6ee7b7
      '52 211 153', // 400 — #34d399
      '16 185 129', // 500 — #10b981
      '5 150 105', // 600 — #059669
      '4 120 87', // 700 — #047857
      '6 95 70', // 800 — #065f46
      '6 78 59', // 900 — #064e3b
      '2 44 34', // 950 — #022c22
    ],
  },
  {
    id: 'foret',
    label: "Forêt",
    family: 'green',
    ramp: [
      '240 253 244', // 50 — #f0fdf4
      '220 252 231', // 100 — #dcfce7
      '187 247 208', // 200 — #bbf7d0
      '134 239 172', // 300 — #86efac
      '74 222 128', // 400 — #4ade80
      '34 197 94', // 500 — #22c55e
      '22 163 74', // 600 — #16a34a
      '21 128 61', // 700 — #15803d
      '22 101 52', // 800 — #166534
      '20 83 45', // 900 — #14532d
      '5 46 22', // 950 — #052e16
    ],
  },
  {
    id: 'sauge',
    label: "Sauge",
    family: 'green',
    ramp: [
      '246 247 245', // 50 — #f6f7f5
      '233 236 230', // 100 — #e9ece6
      '211 217 205', // 200 — #d3d9cd
      '179 191 169', // 300 — #b3bfa9
      '142 160 131', // 400 — #8ea083
      '111 131 101', // 500 — #6f8365
      '87 105 79', // 600 — #57694f
      '70 83 65', // 700 — #465341
      '58 68 55', // 800 — #3a4437
      '50 58 48', // 900 — #323a30
      '25 31 24', // 950 — #191f18
    ],
  },
  {
    id: 'terracotta',
    label: "Terracotta",
    family: 'warm',
    ramp: [
      '253 245 240', // 50 — #fdf5f0
      '250 232 220', // 100 — #fae8dc
      '244 205 180', // 200 — #f4cdb4
      '234 171 134', // 300 — #eaab86
      '222 133 87', // 400 — #de8557
      '208 103 54', // 500 — #d06736
      '184 80 42', // 600 — #b8502a
      '152 61 36', // 700 — #983d24
      '123 51 36', // 800 — #7b3324
      '101 45 33', // 900 — #652d21
      '55 21 15', // 950 — #37150f
    ],
  },
  {
    id: 'cuivre',
    label: "Cuivre",
    family: 'warm',
    ramp: [
      '253 246 240', // 50 — #fdf6f0
      '249 233 216', // 100 — #f9e9d8
      '240 207 174', // 200 — #f0cfae
      '227 171 121', // 300 — #e3ab79
      '209 133 75', // 400 — #d1854b
      '187 106 47', // 500 — #bb6a2f
      '159 85 37', // 600 — #9f5525
      '129 67 33', // 700 — #814321
      '105 56 32', // 800 — #693820
      '88 48 31', // 900 — #58301f
      '47 21 12', // 950 — #2f150c
    ],
  },
  {
    id: 'ambre',
    label: "Ambre",
    family: 'warm',
    ramp: [
      '255 251 235', // 50 — #fffbeb
      '254 243 199', // 100 — #fef3c7
      '253 230 138', // 200 — #fde68a
      '252 211 77', // 300 — #fcd34d
      '251 191 36', // 400 — #fbbf24
      '245 158 11', // 500 — #f59e0b
      '217 119 6', // 600 — #d97706
      '180 83 9', // 700 — #b45309
      '146 64 14', // 800 — #92400e
      '120 53 15', // 900 — #78350f
      '69 26 3', // 950 — #451a03
    ],
  },
  {
    id: 'or',
    label: "Or",
    family: 'warm',
    ramp: [
      '253 250 239', // 50 — #fdfaef
      '250 243 213', // 100 — #faf3d5
      '243 228 166', // 200 — #f3e4a6
      '233 208 113', // 300 — #e9d071
      '221 185 68', // 400 — #ddb944
      '201 160 39', // 500 — #c9a027
      '168 129 30', // 600 — #a8811e
      '133 99 28', // 700 — #85631c
      '109 81 30', // 800 — #6d511e
      '92 68 30', // 900 — #5c441e
      '52 36 13', // 950 — #34240d
    ],
  },
  {
    id: 'corail',
    label: "Corail",
    family: 'warm',
    ramp: [
      '255 245 243', // 50 — #fff5f3
      '255 232 227', // 100 — #ffe8e3
      '255 208 199', // 200 — #ffd0c7
      '255 174 158', // 300 — #ffae9e
      '252 127 104', // 400 — #fc7f68
      '242 87 59', // 500 — #f2573b
      '222 58 30', // 600 — #de3a1e
      '186 44 21', // 700 — #ba2c15
      '154 40 22', // 800 — #9a2816
      '128 39 24', // 900 — #802718
      '70 16 8', // 950 — #461008
    ],
  },
  {
    id: 'chocolat',
    label: "Chocolat",
    family: 'warm',
    ramp: [
      '250 246 244', // 50 — #faf6f4
      '242 233 228', // 100 — #f2e9e4
      '227 209 199', // 200 — #e3d1c7
      '206 176 161', // 300 — #ceb0a1
      '178 136 115', // 400 — #b28873
      '154 107 84', // 500 — #9a6b54
      '129 85 69', // 600 — #815545
      '105 68 58', // 700 — #69443a
      '87 58 51', // 800 — #573a33
      '74 51 46', // 900 — #4a332e
      '40 26 23', // 950 — #281a17
    ],
  },
  {
    id: 'rouge',
    label: "Rouge",
    family: 'red',
    ramp: [
      '254 242 242', // 50 — #fef2f2
      '254 226 226', // 100 — #fee2e2
      '254 202 202', // 200 — #fecaca
      '252 165 165', // 300 — #fca5a5
      '248 113 113', // 400 — #f87171
      '239 68 68', // 500 — #ef4444
      '220 38 38', // 600 — #dc2626
      '185 28 28', // 700 — #b91c1c
      '153 27 27', // 800 — #991b1b
      '127 29 29', // 900 — #7f1d1d
      '69 10 10', // 950 — #450a0a
    ],
  },
  {
    id: 'bordeaux',
    label: "Bordeaux",
    family: 'red',
    ramp: [
      '253 243 244', // 50 — #fdf3f4
      '251 228 231', // 100 — #fbe4e7
      '247 204 211', // 200 — #f7ccd3
      '239 165 178', // 300 — #efa5b2
      '227 115 139', // 400 — #e3738b
      '209 74 104', // 500 — #d14a68
      '179 46 80', // 600 — #b32e50
      '149 35 67', // 700 — #952343
      '125 32 60', // 800 — #7d203c
      '107 31 56', // 900 — #6b1f38
      '60 11 27', // 950 — #3c0b1b
    ],
  },
  {
    id: 'framboise',
    label: "Framboise",
    family: 'red',
    ramp: [
      '255 241 244', // 50 — #fff1f4
      '255 228 233', // 100 — #ffe4e9
      '254 205 214', // 200 — #fecdd6
      '253 164 182', // 300 — #fda4b6
      '251 113 145', // 400 — #fb7191
      '244 63 110', // 500 — #f43f6e
      '225 29 84', // 600 — #e11d54
      '190 18 70', // 700 — #be1246
      '159 18 64', // 800 — #9f1240
      '136 19 60', // 900 — #88133c
      '76 5 28', // 950 — #4c051c
    ],
  },
  {
    id: 'fuchsia',
    label: "Fuchsia",
    family: 'red',
    ramp: [
      '253 244 255', // 50 — #fdf4ff
      '250 232 255', // 100 — #fae8ff
      '245 208 254', // 200 — #f5d0fe
      '240 171 252', // 300 — #f0abfc
      '232 121 249', // 400 — #e879f9
      '217 70 239', // 500 — #d946ef
      '192 38 211', // 600 — #c026d3
      '162 28 175', // 700 — #a21caf
      '134 25 143', // 800 — #86198f
      '112 26 117', // 900 — #701a75
      '74 4 78', // 950 — #4a044e
    ],
  },
  {
    id: 'rose',
    label: "Rose poudré",
    family: 'red',
    ramp: [
      '253 244 245', // 50 — #fdf4f5
      '251 232 234', // 100 — #fbe8ea
      '246 210 216', // 200 — #f6d2d8
      '238 175 185', // 300 — #eeafb9
      '226 130 150', // 400 — #e28296
      '209 91 119', // 500 — #d15b77
      '186 63 96', // 600 — #ba3f60
      '156 48 80', // 700 — #9c3050
      '131 43 72', // 800 — #832b48
      '113 39 67', // 900 — #712743
      '63 17 34', // 950 — #3f1122
    ],
  },
  {
    id: 'prune',
    label: "Prune",
    family: 'purple',
    ramp: [
      '250 245 255', // 50 — #faf5ff
      '243 232 255', // 100 — #f3e8ff
      '233 213 255', // 200 — #e9d5ff
      '216 180 254', // 300 — #d8b4fe
      '192 132 252', // 400 — #c084fc
      '168 85 247', // 500 — #a855f7
      '147 51 234', // 600 — #9333ea
      '126 34 206', // 700 — #7e22ce
      '107 33 168', // 800 — #6b21a8
      '88 28 135', // 900 — #581c87
      '59 7 100', // 950 — #3b0764
    ],
  },
  {
    id: 'lavande',
    label: "Lavande",
    family: 'purple',
    ramp: [
      '246 245 254', // 50 — #f6f5fe
      '238 235 252', // 100 — #eeebfc
      '222 217 249', // 200 — #ded9f9
      '197 188 243', // 300 — #c5bcf3
      '167 149 234', // 400 — #a795ea
      '139 112 222', // 500 — #8b70de
      '116 82 203', // 600 — #7452cb
      '98 65 171', // 700 — #6241ab
      '82 56 140', // 800 — #52388c
      '69 49 114', // 900 — #453172
      '42 28 75', // 950 — #2a1c4b
    ],
  },
] as const;

/** Thème appliqué quand le professionnel n'a rien choisi. */
export const DEFAULT_THEME_ID = 'bleu';

export type ProviderThemeId = string;

/** Le thème demandé, ou le bleu par défaut si l'identifiant est inconnu. */
export function getProviderTheme(id?: string | null): ProviderTheme {
  return (
    PROVIDER_THEMES.find((t) => t.id === id) ??
    PROVIDER_THEMES.find((t) => t.id === DEFAULT_THEME_ID)!
  );
}
