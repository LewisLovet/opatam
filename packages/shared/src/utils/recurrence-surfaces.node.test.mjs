/**
 * Récurrence des périodes bloquées — les SURFACES qui l'écrivent.
 *
 *   node --experimental-strip-types --test packages/shared/src/utils/recurrence-surfaces.node.test.mjs
 *
 * Contrôles statiques, comme pour le multidevise : le service, le dépôt et
 * les cinq formulaires (trois web, deux mobiles) sont lus tels quels. Ce
 * qu'on garde ici, ce sont les pièges déjà tombés une fois :
 *
 *   - un champ accepté par le schéma mais absent de la liste énumérée à
 *     l'écriture est perdu EN SILENCE (`amount`, puis `currency`) ;
 *   - un formulaire qui garde l'ancien `isRecurring: false` croit répéter
 *     et ne répète rien ;
 *   - une suppression qui ignore la série laisse 51 occurrences orphelines.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ici = dirname(fileURLToPath(import.meta.url));
const racine = resolve(ici, '../../../..');
const lire = (chemin) => readFileSync(resolve(racine, chemin), 'utf8');

const service = lire('packages/firebase/src/services/scheduling.service.ts');
const depot = lire('packages/firebase/src/repositories/blockedSlot.repository.ts');

const formulaires = {
  'web · BlockPeriodModal': 'apps/web/app/pro/calendrier/components/BlockPeriodModal.tsx',
  'web · ActivityModal': 'apps/web/app/pro/calendrier/components/ActivityModal.tsx',
  'web · Disponibilités': 'apps/web/app/pro/activite/components/DisponibilitesTab.tsx',
  'mobile · block-slot': 'apps/mobile/app/(pro)/block-slot.tsx',
  'mobile · create-activity': 'apps/mobile/app/(pro)/create-activity.tsx',
};

describe('1. le service écrit la série champ par champ, sans rien perdre', () => {
  it('blockPeriodRecurrent pose seriesId ET la règle sur CHAQUE occurrence', () => {
    const corps = service.slice(service.indexOf('private async preparerSerie('), service.indexOf('async unblockSeries('));
    assert.match(corps, /genererOccurrences\(validated, regle, horloge\)/);
    assert.match(corps, /seriesId: serie,/);
    assert.match(corps, /recurrence: \{/);
    assert.match(service, /createMany\(providerId, docs\)/);
  });
  it('documentDeBlocage garde les champs déjà perdus une fois (amount, currency, spanMode)', () => {
    const debut = service.indexOf('private documentDeBlocage(');
    const corps = service.slice(debut, service.indexOf('\n  }\n', debut));
    for (const champ of ['memberId', 'locationId', 'allDay', 'startTime', 'endTime', 'spanMode', 'reason', 'category', 'title', 'address', 'amount', 'currency']) {
      assert.match(corps, new RegExp(`\\b${champ}:`), `documentDeBlocage écrit ${champ}`);
    }
  });
  it('blockPeriod délègue à la série quand une règle est présente (aucun formulaire ne peut la perdre)', () => {
    const corps = service.slice(service.indexOf('async blockPeriod('), service.indexOf('async blockPeriodRecurrent('));
    assert.match(corps, /if \(validated\.recurrence\)/);
    assert.match(corps, /this\.blockPeriodRecurrent\(providerId, input\)/);
  });
  it('« celle-ci et les suivantes » ne touche pas au passé : filtre sur startDate ≥ from', () => {
    const corps = service.slice(service.indexOf('async unblockSeries('), service.indexOf('async updateSeriesFrom('));
    assert.match(corps, /o\.startDate\.getTime\(\) >= from\.getTime\(\)/);
    const maj = service.slice(service.indexOf('async updateSeriesFrom('), service.indexOf('async rendezVousRecouvertsParMembre('));
    assert.match(maj, /o\.startDate\.getTime\(\) >= from\.getTime\(\)/, 'seules les occurrences à venir sont remplacées');
    assert.match(maj, /this\.preparerSerie\(providerId, input, seriesId\)/, 'la suite est régénérée sous le MÊME seriesId');
  });
  it('les rendez-vous recouverts sont jugés avec la lecture du moteur, dans le fuseau du lieu', () => {
    const corps = service.slice(service.indexOf('async rendezVousRecouvertsParMembre('), service.indexOf('private verifierPeriode('));
    assert.match(corps, /this\.isTimeBlockedBySlot\(b\.datetime, b\.endDatetime/);
    assert.match(corps, /fuseauDuLieuDuMembre\(providerId, id\)/);
    assert.match(corps, /b\.memberId === memberId/);
  });
  it('les réservations de la plage sont lues UNE fois pour toute l’équipe', () => {
    const corps = service.slice(service.indexOf('async rendezVousRecouvertsParMembre('), service.indexOf('async rendezVousRecouverts('));
    assert.equal((corps.match(/getUpcomingByProvider\(/g) ?? []).length, 1, 'une seule requête, quel que soit le nombre de membres');
    const solo = service.slice(service.indexOf('async rendezVousRecouverts('), service.indexOf('private verifierPeriode('));
    assert.match(solo, /this\.rendezVousRecouvertsParMembre\(providerId, \{ \[memberId\]: periodes \}\)/, 'la version « un membre » délègue');
  });
});

describe('2. le dépôt', () => {
  it('createMany écrit par lots ≤ 400 et rend les identifiants dans l’ordre', () => {
    assert.match(depot, /async createMany\(/);
    assert.match(depot, /i \+= 400/);
    assert.match(depot, /writeBatch\(this\.db\)/);
  });
  it('getBySeries : égalité seule, tri en mémoire — aucun index composite à déployer', () => {
    const corps = depot.slice(depot.indexOf('async getBySeries('), depot.indexOf('async deleteMany('));
    assert.match(corps, /where\('seriesId', '==', seriesId\)/);
    assert.doesNotMatch(corps, /orderBy\(/);
    assert.match(corps, /\.sort\(/);
  });
});

describe('3. les cinq formulaires', () => {
  for (const [nom, chemin] of Object.entries(formulaires)) {
    const src = lire(chemin);
    it(`${nom} : plus jamais isRecurring: false`, () => {
      assert.doesNotMatch(src, /isRecurring/);
    });
    it(`${nom} : répète par blockPeriodRecurrent et prévient des rendez-vous recouverts`, () => {
      assert.match(src, /blockPeriodRecurrent\(/);
      assert.match(src, /rendezVousRecouverts(ParMembre)?\(/);
    });
  }
  for (const nom of ['web · BlockPeriodModal', 'web · ActivityModal', 'mobile · block-slot', 'mobile · create-activity']) {
    const src = lire(formulaires[nom]);
    it(`${nom} : en série, modifier propose « celle-ci » ou « celle-ci et les suivantes »`, () => {
      assert.match(src, /updateSeriesFrom\(/);
      assert.match(src, /existingSeriesId/);
    });
  }
  // L'écran mobile block-slot n'a pas de bouton Supprimer : la suppression
  // vit dans l'agenda et dans la liste des créneaux bloqués (section 4).
  for (const nom of ['web · BlockPeriodModal', 'web · ActivityModal', 'mobile · create-activity']) {
    const src = lire(formulaires[nom]);
    it(`${nom} : supprimer propose aussi la portée`, () => {
      assert.match(src, /unblockSeries\(/);
    });
  }
});

describe('3 bis. la portée choisie survit à l’avertissement de conflits', () => {
  // Défaut trouvé à l'audit : `portee` ne dit que QUELLE question est posée
  // et retombe à `null` une fois répondue. La déduire au moment de confirmer
  // un conflit ramenait « celle-ci et les suivantes » à « celle-ci », sans
  // rien dire. La portée retenue est donc gardée à part.
  for (const nom of ['web · BlockPeriodModal', 'web · ActivityModal']) {
    const src = lire(formulaires[nom]);
    it(`${nom} : le conflit est confirmé avec la portée retenue, pas déduite`, () => {
      assert.match(src, /const \[porteeRetenue, setPorteeRetenue\] = useState<'cette' \| 'suivantes'>\('cette'\)/);
      assert.match(src, /setPorteeRetenue\(quoi\);/, 'retenue à l’entrée de `enregistrer`');
      assert.match(src, /onConfirmer=\{\(\) => void enregistrer\(porteeRetenue, true\)\}/);
      assert.doesNotMatch(src, /portee === 'enregistrer' \? 'suivantes' : 'cette'/, 'plus aucune déduction');
    });
  }
  it('web · BlockPeriodModal lit les réservations de l’équipe en une fois', () => {
    const src = lire(formulaires['web · BlockPeriodModal']);
    assert.match(src, /rendezVousRecouvertsParMembre\(/);
    assert.doesNotMatch(src, /targets\.map\(\(m\) => schedulingService\.rendezVousRecouverts\(/, 'plus une requête par membre');
  });
});

describe('3 ter. les six points de l’audit externe', () => {
  const service = lire('packages/firebase/src/services/scheduling.service.ts');

  it('1. le jour affiché EST le jour enregistré : une seule normalisation, partagée', () => {
    const rec = lire('packages/shared/src/utils/recurrence.ts');
    assert.match(rec, /export function reglePourPeriode\(/, 'le paquet partagé décide des jours');
    for (const nom of ['web · BlockPeriodModal', 'web · ActivityModal', 'mobile · block-slot', 'mobile · create-activity']) {
      const src = lire(formulaires[nom]);
      assert.match(src, /regleAEnregistrer\(/, `${nom} enregistre la règle normalisée`);
    }
    for (const chemin of [
      'apps/web/app/pro/calendrier/components/RecurrenceFields.tsx',
      'apps/mobile/components/business/RecurrenceFields/RecurrenceFields.tsx',
    ]) {
      const src = lire(chemin);
      assert.match(src, /const regle = value \? regleAEnregistrer\(/, 'l’aperçu montre la règle normalisée');
      assert.match(src, /const weekdays = regle\?\.weekdays \?\? \[\]/, 'les jours affichés sont ceux de la règle normalisée');
      assert.doesNotMatch(src, /trierJoursSemaine\(\[\.\.\.value\.weekdays/, 'plus de normalisation locale, divergente');
    }
    assert.match(lire('packages/shared/src/schemas/availability.schema.ts'), /reglePourPeriode\(data\.recurrence, data\)/);
  });

  it('2. remplacer une série n’efface plus avant de créer', () => {
    const depot = lire('packages/firebase/src/repositories/blockedSlot.repository.ts');
    assert.match(depot, /async remplacerSerie\(/);
    assert.match(depot, /if \(idsASupprimer\.length \+ docs\.length <= 450\)/, 'un seul lot quand ça tient');
    const maj = service.slice(service.indexOf('async updateSeriesFrom('), service.indexOf('async rendezVousRecouvertsParMembre('));
    assert.match(maj, /remplacerSerie\(providerId, aRemplacer/);
    assert.doesNotMatch(maj, /this\.unblockSeries\(/, 'plus de suppression préalable');
  });

  it('3. la génération se fait dans le fuseau du LIEU', () => {
    const prep = service.slice(service.indexOf('private async preparerSerie('), service.indexOf('async unblockSeries('));
    assert.match(prep, /horlogeDuFuseau\(await this\.fuseauDuLieuDuMembre\(providerId, validated\.memberId\)\)/);
    assert.match(prep, /genererOccurrences\(validated, regle, horloge\)/);
    const hor = lire('packages/shared/src/utils/fuseaux.ts');
    assert.match(hor, /export function horlogeDuFuseau\(/, 'l’horloge vit avec le socle horaire');
    assert.match(hor, /instantApresSaut/, 'heure inexistante : on décale, on ne saute pas l’occurrence');
    assert.match(hor, /return r\.premiere;/, 'heure doublée : la première, comme le moteur');
    assert.doesNotMatch(lire('packages/shared/src/utils/recurrence.ts'), /^import /m, 'le générateur reste sans dépendance');
    for (const nom of ['web · BlockPeriodModal', 'web · ActivityModal', 'mobile · block-slot', 'mobile · create-activity']) {
      assert.match(lire(formulaires[nom]), /useFuseauxMembres\(/, `${nom} lit le fuseau du lieu de son membre`);
    }
  });

  it('4. un blocage marque la prochaine disponibilité à recalculer', () => {
    const trig = lire('functions/src/triggers/onBlockedSlotWriteNextSlot.ts');
    assert.match(trig, /document: 'providers\/\{providerId\}\/blockedSlots\/\{blockedSlotId\}'/);
    assert.match(trig, /nextSlotDirty === true\) return;/, 'une série ne réécrit pas N fois le prestataire');
    const cron = lire('functions/src/scheduled/recalculateDirtySlots.ts');
    assert.match(cron, /schedule: 'every 5 minutes'/);
    assert.match(cron, /nextSlotDirty', '==', true/);
    assert.match(cron, /calculateNextAvailableSlot\(doc\.id\)/);
    const index = lire('functions/src/index.ts');
    assert.match(index, /onBlockedSlotWriteNextSlot/);
    assert.match(index, /recalculateDirtySlots/);
  });

  it('5. modifier une série garde la devise FIGÉE de l’activité', () => {
    for (const chemin of [
      'apps/web/app/pro/calendrier/components/ActivityModal.tsx',
      'apps/mobile/app/(pro)/create-activity.tsx',
    ]) {
      const src = lire(chemin);
      assert.match(src, /existingCurrency/, `${chemin} relit la devise figée`);
      assert.match(src, /currency: existingCurrency \?\? devise/, 'la devise du jour ne sert qu’à la création');
      assert.doesNotMatch(src, /updateSeriesFrom\([^)]*\{[^}]*currency: devise(Prov|Pro)\(?\)?,/s, 'plus de devise du jour sur une série');
    }
  });

  it('6. les stats comptent dans le fuseau du lieu, et le mois ne s’écrit plus en concurrence', () => {
    const ctx = lire('functions/src/lib/providerStatsRecompute.ts');
    assert.match(ctx, /timezone: string;/, 'le contexte porte le fuseau');
    assert.match(ctx, /locations`\)\.get\(\)/, 'lu sur les LIEUX, pas sur provider.settings');
    assert.match(ctx, /timezone: ctx\.timezone/);
    assert.match(ctx, /await db\.runTransaction\(async \(tx\) => \{\s*await tx\.get\(ref\);/, 'le doc mensuel est lu dans la transaction : c’est le point de contention');
    // Le fuseau vient du DOCUMENT : figé sur la réservation, celui du lieu
    // pour l'activité. Celui du lieu principal n'est qu'un repli — un
    // prestataire peut tenir deux lieux dans deux fuseaux.
    const resa = lire('functions/src/triggers/onBookingWriteProviderStats.ts');
    assert.match(resa, /dateKeyInTz\(beforeBooking\.datetime, beforeBooking\.timezone \|\| ctx\.timezone\)/);
    assert.match(resa, /dateKeyInTz\(afterBooking\.datetime, afterBooking\.timezone \|\| ctx\.timezone\)/);
    const act = lire('functions/src/triggers/onBlockedSlotWriteProviderStats.ts');
    assert.match(act, /ctx\.timezonesByLocation\[raw\.locationId\]/);
    for (const mir of ['packages/shared/src/utils/providerStats.ts', 'functions/src/lib/providerStatsAgg.ts']) {
      const src = lire(mir);
      assert.match(src, /timezonesByLocation\?: Record<string, string>;/, `${mir} : table des fuseaux par lieu`);
      assert.match(src, /timezone \|\| tzDefaut/, `${mir} : le fuseau figé de la réservation d'abord`);
    }
  });

  it('bonus : « cette occurrence seulement » ne cherche plus de conflits dans toute la série', () => {
    for (const nom of ['web · BlockPeriodModal', 'web · ActivityModal', 'mobile · block-slot', 'mobile · create-activity']) {
      const src = lire(formulaires[nom]);
      assert.match(src, /existingSeriesId && quoi === 'cette'/, `${nom} limite le contrôle à la période écrite`);
    }
  });
});

describe('3 quater. le troisième audit : équipe multi-fuseaux, édition, chargement, anciens formats', () => {
  const multi = ['web · BlockPeriodModal', 'mobile · block-slot'];
  const tous = ['web · BlockPeriodModal', 'web · ActivityModal', 'mobile · block-slot', 'mobile · create-activity'];

  for (const nom of multi) {
    const src = lire(formulaires[nom]);
    it(`${nom} : la période se construit PAR membre, dans le fuseau de SON lieu`, () => {
      assert.match(src, /periodeDepuisSaisie\(saisieMurale\(\), fuseaux\[memberId\]\)/);
      assert.match(src, /const inputPour = \(member: WithId<Member>\): BlockedSlotInput =>/);
      assert.doesNotMatch(src, /const \[fuseau, setFuseau\]/, 'plus de fuseau unique pour toute l’équipe');
      assert.doesNotMatch(src, /\.\.\.base,\s*memberId: member\.id/, 'plus un même instant recopié à chaque membre');
    });
    it(`${nom} : chaque membre est confronté à SES périodes`, () => {
      assert.match(src, /rendezVousRecouvertsParMembre\(\s*providerId,\s*periodesParMembre/);
    });
  }

  for (const nom of tous) {
    const src = lire(formulaires[nom]);
    it(`${nom} : l’édition se remplit dans le fuseau du lieu, une fois celui-ci connu`, () => {
      assert.match(src, /saisieDepuisPeriode\(aHydrater, fuseaux\[aHydrater\.memberId\]\)/);
      assert.match(src, /if \(!aHydrater \|\| !fuseaux?Prets?\) return;/);
      assert.doesNotMatch(src, /setStartTime\(formatTimeInput\(startDt\)\)|setStartTime\(startDt\)|sd\.setHours\(sh, sm/, 'plus de getters de l’appareil à l’hydratation');
      assert.match(src, /setExistingStart\(new Date\(existing\.startDate\.getTime\(\)\)\)/, 'la borne « suivantes » est l’instant ENREGISTRÉ');
    });
    it(`${nom} : l’enregistrement ne peut pas partir pendant la lecture du fuseau`, () => {
      assert.match(src, /disabled=\{[^}]*!fuseaux?Prets?/, 'bouton éteint tant que la lecture n’est pas finie');
      assert.match(src, /if \((?:!providerId \|\| )?!fuseaux?Prets?\) return;/, 'garde de dernier recours dans le gestionnaire');
    });
  }

  it('les deux hooks distinguent « en cours » de « lu, sans fuseau »', () => {
    for (const chemin of ['apps/web/app/pro/calendrier/components/useFuseauxMembres.ts', 'apps/mobile/hooks/useFuseauxMembres.ts']) {
      const src = lire(chemin);
      assert.match(src, /fuseauxPrets\(memberIds, fuseaux\)/, `${chemin} : prêt = tous les membres LUS`);
      assert.match(src, /\.catch\(\(\) => Object\.fromEntries\(manquants\.map\(\(id\) => \[id, null\]\)\)\)/, `${chemin} : une erreur ne bloque pas à vie`);
    }
  });

  it('le dépôt normalise `recurrence` à la lecture, en UN seul endroit', () => {
    const depot = lire('packages/firebase/src/repositories/blockedSlot.repository.ts');
    assert.match(depot, /function versModele\(/);
    assert.match(depot, /normaliserRecurrence\(modele\.recurrence\)/);
    // Une seule occurrence : celle de versModele lui-même.
    assert.equal((depot.match(/convertTimestamps<BlockedSlot>\(/g) ?? []).length, 1, 'toutes les lectures passent par versModele');
    assert.ok((depot.match(/versModele\(/g) ?? []).length >= 9, 'les neuf lectures du dépôt');
  });
});

describe('4. les listes et l’agenda mobile connaissent les séries', () => {
  it('l’agenda mobile propose la portée avant de supprimer une occurrence', () => {
    const src = lire('apps/mobile/app/(pro)/(tabs)/calendar.tsx');
    assert.match(src, /slot\?\.seriesId/);
    assert.match(src, /unblockSeries\(providerId, serie, slot\.startDate\)/);
  });
  it('la liste mobile regroupe une série en une ligne et supprime ses occurrences à venir', () => {
    const src = lire('apps/mobile/app/(pro)/blocked-slots.tsx');
    assert.match(src, /`serie-\$\{slot\.seriesId\}`/);
    assert.match(src, /unblockSeries\(providerId, serie, aujourdhui\)/);
  });
  it('l’onglet Disponibilités web fait de même', () => {
    const src = lire('apps/web/app/pro/activite/components/BlockedSlotsSection.tsx');
    assert.match(src, /seriesVues/);
    assert.match(src, /onDeleteSeries/);
  });
  it('les cinq langues mobiles portent le vocabulaire de la répétition', () => {
    for (const loc of ['fr', 'en', 'it', 'pt', 'de']) {
      const d = JSON.parse(lire(`apps/mobile/locales/app/${loc}.json`));
      assert.ok(d.recurrence, `${loc}: recurrence`);
      for (const k of ['toggle', 'until', 'describeWeekly', 'describeEveryN', 'scope', 'conflicts', 'saved_one', 'saved_other', 'listSummary']) {
        assert.ok(d.recurrence[k] !== undefined, `${loc}: recurrence.${k}`);
      }
      for (const code of ['intervalle', 'aucunJour', 'aucuneOccurrence', 'plusieursJoursMultiJours', 'finAvantDebut', 'finAvantPremiere', 'horizon']) {
        assert.ok(d.recurrence.errors[code], `${loc}: recurrence.errors.${code}`);
      }
    }
  });
});

describe('5. le jour de départ se décoche à l’écran, web comme mobile', () => {
  const composants = {
    web: 'apps/web/app/pro/calendrier/components/RecurrenceFields.tsx',
    mobile: 'apps/mobile/components/business/RecurrenceFields/RecurrenceFields.tsx',
  };
  for (const [nom, chemin] of Object.entries(composants)) {
    it(`${nom} : aucun jour n’est figé — la date saisie n’est qu’un point de départ`, () => {
      const src = lire(chemin);
      assert.doesNotMatch(src, /jourDeBase/, 'plus de jour de base verrouillé');
      assert.doesNotMatch(src, /\bfige\b/, 'plus de pastille désactivée');
      const bascule = src.slice(src.indexOf('const basculerJour'), src.indexOf('const finDans'));
      assert.match(bascule, /weekdays\.filter\(\(x\) => x !== j\)/, 'toucher un jour coché le décoche, quel qu’il soit');
      assert.match(bascule, /if \(plusieursJours\) return changerJours\(\[j\]\)/, 'plusieurs jours : toucher un jour le choisit comme départ');
    });
  }
  it('mobile : chaque libellé de la répétition existe dans les cinq langues', () => {
    const src = lire(composants.mobile);
    const cles = new Set([...src.matchAll(/t\('recurrence\.([A-Za-z_.]+)'/g)].map((m) => m[1]));
    for (const m of src.matchAll(/cle: '([A-Za-z]+)'/g)) cles.add(m[1]);
    assert.ok(cles.size >= 15, `clés relevées : ${[...cles].join(', ')}`);
    for (const loc of ['fr', 'en', 'it', 'pt', 'de']) {
      const d = JSON.parse(lire(`apps/mobile/locales/app/${loc}.json`)).recurrence;
      for (const k of cles) {
        const present = d[k] !== undefined || (d[`${k}_one`] !== undefined && d[`${k}_other`] !== undefined);
        assert.ok(present, `${loc}: recurrence.${k}`);
      }
    }
  });
});
