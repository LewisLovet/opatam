import Image from 'next/image';

/**
 * L'écran d'attente de marque, pendant qu'une page se prépare.
 *
 * POURQUOI PAS UN SQUELETTE ICI : un squelette vaut quand la page a une
 * structure stable à annoncer — c'est le cas de la vitrine, qui garde le
 * sien. Le tunnel de réservation, lui, change de forme à chaque étape ; en
 * dessiner une par avance annoncerait une mise en page qui ne viendra pas.
 *
 * POURQUOI PAS DE GRAND APLAT DE COULEUR, contrairement au démarrage de
 * l'application mobile : sur mobile l'écran suivant est celui d'Opatam. Ici
 * il est aux couleurs du salon, et un plein écran bleu au milieu d'un
 * parcours bordeaux réintroduirait exactement la rupture qu'on vient de
 * supprimer côté mobile. La surface reste donc neutre et seul le logo porte
 * la marque.
 *
 * LE LOGO EST SERVI EN LOCAL, et c'est délibéré : `ASSETS.logos` pointe sur
 * Firebase Storage, et faire dépendre un écran d'attente d'un fetch distant
 * est précisément la faute qu'on vient de corriger au démarrage de l'app —
 * le temps d'attente attendait lui-même quelque chose.
 *
 * `aria-busy` et le texte masqué : l'animation ne dit rien à un lecteur
 * d'écran, qui annoncerait sinon une page vide.
 */
export function BrandLoading({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-busy="true"
      className="min-h-[70vh] flex flex-col items-center justify-center gap-8 px-6"
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
@keyframes opatam-ring {
  0%   { transform: scale(.72); opacity: 0; }
  15%  { opacity: .18; }
  100% { transform: scale(2.1); opacity: 0; }
}
@keyframes opatam-dot {
  0%, 100% { transform: translateY(0);    opacity: .35; }
  50%      { transform: translateY(-6px); opacity: 1; }
}
.opatam-ring { animation: opatam-ring 2.1s ease-out infinite; }
.opatam-dot  { animation: opatam-dot .84s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .opatam-ring { animation: none; opacity: .18; transform: scale(1.4); }
  .opatam-dot  { animation: none; opacity: .55; }
}
/* Les points seuls demandent un eclaircissement en mode sombre ; le
   monogramme, lui, est blanc sur aplat plein dans les deux cas.

   La regle est ecrite ICI et non avec un variant "dark:" de Tailwind : la
   configuration est en darkMode "class", or les pages PUBLIQUES ne portent
   aucune classe "dark" - leur mode sombre vient des variables CSS. Un
   "dark:" y serait purement decoratif. Le garde reprend celui de
   ProviderThemeStyle, pour que le choix explicite l'emporte dans les deux
   sens. */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) .opatam-dot { background-color: rgb(147 197 253); }
}
:root[data-theme="dark"] .opatam-dot { background-color: rgb(147 197 253); }`,
        }}
      />

      <div className="relative flex items-center justify-center w-32 h-32">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            aria-hidden
            className="opatam-ring absolute w-24 h-24 rounded-full bg-primary-500"
            style={{ animationDelay: `${i * 0.7}s` }}
          />
        ))}
        {/* L'ICÔNE DE L'APPLICATION telle quelle : monogramme blanc sur son
            bleu. Le monogramme bleu nuit se posait auparavant sur des anneaux
            bleus — du bleu sur du bleu, illisible d'un coup d'œil.
            Reconstituer la pastille avec `bg-primary-600` ne marchait pas non
            plus : hors de la portée `data-provider-theme`, ce jeton prend une
            valeur qui n'est ni celle du salon ni celle de la marque. L'image
            porte sa propre couleur, elle ne dépend de rien. */}
        <Image
          src="/icone-app-opatam.png"
          alt=""
          width={80}
          height={80}
          priority
          className="relative rounded-2xl"
        />
      </div>

      <div className="flex gap-2.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="opatam-dot w-2 h-2 rounded-full bg-primary-600"
            style={{ animationDelay: `${i * 0.22}s` }}
          />
        ))}
      </div>

      <span className="sr-only">{label}</span>
    </div>
  );
}
