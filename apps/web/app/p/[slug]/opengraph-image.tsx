/**
 * Image sociale d'une fiche prestataire — 1200 × 630.
 *
 * POURQUOI ELLE EXISTE. La fiche déclarait la photo de couverture du salon en
 * `og:image`. Elle est joignable et valide, mais les clients ne l'utilisent
 * pas toujours : une couverture est une photo arbitraire, de rapport et de
 * poids quelconques — celle de « Salon de Coiffure » fait 1200 × 400 pour
 * 678 Ko, loin du 1,91:1 attendu. Messages la refusait et retombait sur le
 * favicon du site : un professionnel qui partageait SA page voyait apparaître
 * le logo Opatam sur un fond que l'application inventait toute seule.
 *
 * Le fond inventé venait de là : `app/icon.png` est un PNG TRANSPARENT, et
 * un client qui doit afficher une icône transparente choisit lui-même la
 * couleur derrière. D'où une teinte que personne n'avait décidée.
 *
 * Cette image reprend la main : format exact, poids maîtrisé, et surtout ce
 * qu'il faut y voir — le salon, pas la plateforme.
 */
import { ImageResponse } from 'next/og';
import { providerRepository } from '@booking-app/firebase';
import { getProviderTheme } from '@booking-app/shared/constants';

export const alt = 'Réserver en ligne';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** `'31 31 31'` → `'#1f1f1f'`. Le catalogue est stocké en canaux RVB. */
function canauxVersHex(canaux: string): string {
  return (
    '#' +
    canaux
      .split(' ')
      .map((n) => Number(n).toString(16).padStart(2, '0'))
      .join('')
  );
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return (
    (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255
  );
}

export default async function ProviderOgImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const provider = await providerRepository.getBySlug(slug);

  const nom = provider?.businessName ?? 'Opatam';
  const ville = provider?.cities?.[0] ?? '';
  const photo = provider?.photoURL ?? null;
  const couverture = provider?.coverPhotoURL ?? null;

  // La gamme du salon habille l'image, comme elle habille sa page. C'est la
  // seule couleur choisie ici — et elle est choisie, non devinée.
  const gamme = getProviderTheme(provider?.themeId);
  const fonce = canauxVersHex(gamme.ramp[9]);
  const moyen = canauxVersHex(gamme.ramp[6]);
  const encre = luminance(moyen) > 0.45 ? '#111827' : '#ffffff';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          background: `linear-gradient(135deg, ${moyen} 0%, ${fonce} 100%)`,
          fontFamily: 'sans-serif',
        }}
      >
        {/* La couverture en fond, assombrie pour que le texte tienne. */}
        {couverture ? (
          <img
            src={couverture}
            width={1200}
            height={630}
            style={{
              position: 'absolute',
              inset: 0,
              width: 1200,
              height: 630,
              objectFit: 'cover',
              opacity: 0.42,
            }}
          />
        ) : null}

        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            width: '100%',
            height: '100%',
            padding: 68,
            background:
              'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.62) 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
            {photo ? (
              <img
                src={photo}
                width={132}
                height={132}
                style={{
                  width: 132,
                  height: 132,
                  borderRadius: 66,
                  objectFit: 'cover',
                  border: '5px solid rgba(255,255,255,0.92)',
                }}
              />
            ) : (
              <div
                style={{
                  width: 132,
                  height: 132,
                  borderRadius: 66,
                  background: moyen,
                  color: encre,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 58,
                  fontWeight: 700,
                  border: '5px solid rgba(255,255,255,0.92)',
                }}
              >
                {nom.charAt(0).toUpperCase()}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 880 }}>
              <span
                style={{
                  fontSize: 62,
                  fontWeight: 700,
                  color: '#ffffff',
                  lineHeight: 1.05,
                  letterSpacing: -1,
                }}
              >
                {nom}
              </span>
              {ville ? (
                <span
                  style={{
                    fontSize: 30,
                    color: 'rgba(255,255,255,0.86)',
                    marginTop: 10,
                    textTransform: 'capitalize',
                  }}
                >
                  {ville}
                </span>
              ) : null}
            </div>
          </div>

          <span
            style={{
              fontSize: 26,
              letterSpacing: 3,
              color: 'rgba(255,255,255,0.8)',
              marginTop: 34,
              textTransform: 'uppercase',
            }}
          >
            Réservez en ligne · opatam.com
          </span>
        </div>
      </div>
    ),
    size
  );
}
