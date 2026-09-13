'use client';

import Image from 'next/image';
import { useState } from 'react';
import { ArrowRight, Maximize2 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { CaptureViewer } from './CaptureViewer';
import s from './v1.module.css';

type StoryScreen = { title: string; src?: string };
type StoryCategory = { id: string; label: string; title: string; description: string; screens: [StoryScreen, StoryScreen] };

// Only original, available captures are shown. Populate the remaining pairs
// when the user supplies them; never relabel availability images as other UI.
const categories: StoryCategory[] = [
  { id: 'dispos', label: 'Disponibilités', title: 'Un créneau libre ? Faites-le savoir.', description: 'Partagez vos disponibilités du jour ou de la semaine. Votre audience voit quand réserver, sans échange de messages.', screens: [{ title: 'Les dispos du jour', src: '/instagram-story-jour.png' }, { title: 'Les dispos de la semaine', src: '/instagram-story-semaine.png' }] },
  { id: 'prestations', label: 'Prestations', title: 'Donnez envie de découvrir vos prestations.', description: 'Présentez votre carte et vos tarifs dans une story prête à publier. Gardez le lien avec votre communauté, sans repartir d’une page blanche.', screens: [{ title: 'Vos prestations · aperçu 1' }, { title: 'Vos prestations · aperçu 2' }] },
  { id: 'realisations', label: 'Réalisations', title: 'Votre travail est votre meilleur contenu.', description: 'Mettez vos réalisations en lumière et montrez ce qui rend votre savoir-faire unique.', screens: [{ title: 'Vos réalisations · aperçu 1' }, { title: 'Vos réalisations · aperçu 2' }] },
  { id: 'avant-apres', label: 'Avant / après', title: 'Montrez la différence que vous faites.', description: 'Associez vos photos avant et après pour donner à voir le résultat de votre travail.', screens: [{ title: 'Avant / après · aperçu 1' }, { title: 'Avant / après · aperçu 2' }] },
  { id: 'avis', label: 'Avis clients', title: 'Leurs mots donnent confiance.', description: 'Partagez un avis client ou votre note globale. Une façon simple de rassurer les personnes qui vous découvrent.', screens: [{ title: 'Un avis client' }, { title: 'Votre note globale' }] },
  { id: 'fidelite', label: 'Fidélité', title: 'Donnez-leur une raison de revenir.', description: 'Faites connaître votre programme de fidélité et entretenez la relation avec les clients qui vous suivent.', screens: [{ title: 'Votre fidélité · aperçu 1' }, { title: 'Votre fidélité · aperçu 2' }] },
  { id: 'page', label: 'Votre page', title: 'Un chemin direct vers la réservation.', description: 'Partagez votre page et son QR code pour que votre audience retrouve facilement vos prestations.', screens: [{ title: 'Votre page · aperçu 1' }, { title: 'Votre page · aperçu 2' }] },
];

// Seules les catégories dont les DEUX captures existent sont montrées. Les
// autres affichaient au visiteur un cadre gris « Capture originale à
// intégrer » : six onglets sur sept étaient vides. Poser la capture dans la
// liste ci-dessus suffit à faire réapparaître l'onglet.
const visibles = categories.filter((category) => category.screens.every((screen) => screen.src));

export function StoriesSection() {
  const [selected, setSelected] = useState(visibles[0]?.id ?? '');
  const [expanded, setExpanded] = useState<StoryScreen | null>(null);
  if (!visibles.length) return null;
  return <section id="stories" className={s.socialSection}>
    <div className={s.wrap}>
      <div className={s.socialHeading} data-reveal><p className={s.eyebrow}>VOTRE MÉTIER A DE QUOI FAIRE PARLER</p><h2>Du contenu à partager.<br /><em>Une audience à fidéliser.</em></h2><p>Disponibilités, réalisations, avis : transformez votre quotidien en contenu pour vos réseaux sociaux. Moins de temps à créer vos stories, plus de régularité pour garder le lien avec votre communauté.</p></div>
      <Tabs defaultValue={visibles[0].id} value={selected} onValueChange={setSelected}>
        <TabsList className={s.socialTabs} aria-label="Types de stories" onKeyDown={event => {
          const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End'];
          if (!keys.includes(event.key)) return;
          event.preventDefault();
          const index = visibles.findIndex(category => category.id === selected);
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? visibles.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + visibles.length) % visibles.length;
          setSelected(visibles[next].id);
          document.getElementById(`story-tab-${visibles[next].id}`)?.focus();
        }}>{visibles.map(category => <TabsTrigger key={category.id} value={category.id} id={`story-tab-${category.id}`} aria-controls={`story-panel-${category.id}`} tabIndex={selected === category.id ? 0 : -1} className={s.socialTab}>{category.label}</TabsTrigger>)}</TabsList>
        {visibles.map(category => <TabsContent key={category.id} value={category.id} id={`story-panel-${category.id}`} aria-labelledby={`story-tab-${category.id}`} className={s.socialPanel}>
          <div className={s.storyPitch}><span className={s.socialCategory}>{category.label}</span><h3>{category.title}</h3><p>{category.description}</p><a href="#telecharger" className={s.primary}>Découvrir l’application <ArrowRight size={18} /></a><small>Créez dans Opatam. Partagez sur vos réseaux.</small></div>
          <div className={s.storyPair}>{category.screens.map((screen, index) => <figure key={`${category.id}-${index}`}>
            <button className={s.storyPreviewButton} onClick={() => setExpanded(screen)} aria-label={`Agrandir : ${screen.title}`}><Image src={screen.src!} alt={`Story Opatam : ${screen.title}`} width={540} height={960} sizes="(max-width: 600px) 43vw, 270px" /><span><Maximize2 size={17} /></span></button>
            <figcaption>{screen.title}</figcaption>
          </figure>)}</div>
        </TabsContent>)}
      </Tabs>
    </div>
    {expanded?.src && <CaptureViewer src={expanded.src} title={expanded.title} onClose={() => setExpanded(null)} />}
  </section>;
}
