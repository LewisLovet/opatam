/**
 * Image sociale de la verticale studio.
 *
 * L'image par défaut était `logo-opatam.png` : un logo sur fond blanc, qui ne
 * porte ni le message ni l'univers de la page. Partagée sur LinkedIn ou dans
 * une conversation, elle ne dit rien de ce qu'on y trouve.
 *
 * Elle est GÉNÉRÉE plutôt que dessinée : pas de photo à produire, pas de
 * fichier à maintenir en parallèle du texte, et la grille des trois salles
 * reprend littéralement l'argument de la page — une salle, un agenda.
 * Next la rend au build et la sert en statique.
 */
import { ImageResponse } from 'next/og';

export const alt = "Opatam — logiciel de réservation pour studio d'enregistrement";
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const ROOMS = [
  { name: 'NAÏM', slots: [true, true, false] },
  { name: 'CLARA', slots: [false, true, true] },
  { name: 'YANIS', slots: [true, false, true] },
];

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#0B0B0D',
          color: '#F4F2EE',
          padding: 72,
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span
            style={{
              fontSize: 22,
              letterSpacing: 4,
              color: '#60A5FA',
              textTransform: 'uppercase',
            }}
          >
            Pour les studios d&apos;enregistrement
          </span>
          <span style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.05, marginTop: 24 }}>
            Votre équipe.
          </span>
          <span style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.05 }}>Un agenda chacun.</span>
          <span style={{ fontSize: 28, color: '#A1A1AA', marginTop: 26 }}>
  Vos artistes choisissent avec qui ils enregistrent.
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          {/* La grille des trois salles : l'argument, en image. */}
          <div style={{ display: 'flex', gap: 16 }}>
            {ROOMS.map((room) => (
              <div key={room.name} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span style={{ fontSize: 16, color: '#71717A', letterSpacing: 2 }}>
                  {room.name}
                </span>
                {room.slots.map((taken, i) => (
                  <div
                    key={i}
                    style={{
                      width: 150,
                      height: 40,
                      borderRadius: 10,
                      background: taken ? '#2563EB' : 'transparent',
                      border: taken ? '1px solid #2563EB' : '1px dashed #3F3F46',
                    }}
                  />
                ))}
              </div>
            ))}
          </div>

          <span style={{ fontSize: 36, fontWeight: 700, letterSpacing: 2 }}>OPATAM</span>
        </div>
      </div>
    ),
    size,
  );
}
