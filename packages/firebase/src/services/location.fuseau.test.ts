/**
 * Le fuseau d'un lieu, à la création et au déménagement.
 *
 *   npx tsx --test packages/firebase/src/services/location.fuseau.test.ts
 *
 * Deux règles de DONNÉES, dont l'échec ne produit aucune erreur :
 *  - le champ doit ARRIVER en base (il a déjà été perdu trois fois par une
 *    liste blanche d'écriture) ;
 *  - un fuseau deviné pour l'ANCIENNE adresse ne doit pas survivre à un
 *    déménagement qu'on ne sait plus trancher.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { locationRepository, memberRepository, providerRepository } from '../repositories';
import { locationService } from './location.service';

const anyOf = <T,>(o: T) => o as unknown as Record<string, unknown>;

interface Capture {
  cree: Record<string, unknown> | null;
  maj: Record<string, unknown> | null;
}

function armer(existant: Record<string, unknown> = {}): Capture {
  const capture: Capture = { cree: null, maj: null };
  anyOf(locationRepository).getByProvider = async () => [];
  anyOf(locationRepository).create = async (_p: string, doc: Record<string, unknown>) => {
    capture.cree = doc;
    return 'l1';
  };
  anyOf(locationRepository).getById = async () => ({
    id: 'l1', name: 'Salon', countryCode: 'FR', postalCode: '97400', geopoint: null, ...existant,
  });
  anyOf(locationRepository).update = async (_p: string, _l: string, patch: Record<string, unknown>) => {
    capture.maj = patch;
  };
  anyOf(providerRepository).getById = async () => ({ id: 'p1', cities: [] });
  anyOf(providerRepository).update = async () => undefined;
  // Sans ces bouchons, le service part interroger Firestore pour de vrai
  // et le test reste SUSPENDU sans le moindre message.
  anyOf(locationRepository).countByProvider = async () => 1;
  anyOf(locationRepository).getActiveByProvider = async () => [];
  anyOf(locationRepository).getDefault = async () => null;
  anyOf(memberRepository).getByLocation = async () => [];
  return capture;
}

const BASE = {
  name: 'Mon salon',
  address: '1 rue de la Plage',
  city: 'Saint-Denis',
  postalCode: '97400',
  countryCode: 'FR',
  type: 'fixed' as const,
};

describe('création : le fuseau est résolu ET persisté', () => {
  it('un salon réunionnais SANS coordonnées est posé en Indian/Reunion', async () => {
    // Le code postal suffit. Le champ doit surtout ARRIVER dans le
    // document : `createLocation` le perdait, comme il avait déjà perdu
    // `affiliateCode` et `themeId`.
    const c = armer();
    await locationService.createLocation('p1', BASE as never);
    assert.equal(c.cree?.timezone, 'Indian/Reunion');
    assert.equal(c.cree?.timezoneSource, 'automatic');
  });

  it('un salon parisien reste Europe/Paris', async () => {
    const c = armer();
    await locationService.createLocation('p1', { ...BASE, postalCode: '75001', city: 'Paris' } as never);
    assert.equal(c.cree?.timezone, 'Europe/Paris');
  });

  it('rien d’exploitable → AUCUN fuseau écrit, pas un fuseau inventé', async () => {
    const c = armer();
    await locationService.createLocation(
      'p1',
      { ...BASE, postalCode: '', city: 'Inconnue', countryCode: 'US' } as never,
    );
    assert.equal(c.cree?.timezone, undefined);
    assert.equal(c.cree?.timezoneSource, undefined);
  });
});

describe('déménagement : un fuseau périmé ne survit pas', () => {
  it('vers un pays qu’on ne sait pas trancher, l’ancien est EFFACÉ', async () => {
    // Un salon deviné « Europe/Paris » qui part aux États-Unis : garder
    // Paris serait pire que n'avoir aucun fuseau, parce que plus rien ne
    // le signalerait. On remet le lieu « à renseigner ».
    const c = armer({ timezone: 'Europe/Paris', timezoneSource: 'automatic' });
    await locationService.updateLocation('p1', 'l1', {
      countryCode: 'US', postalCode: '10001', city: 'New York',
    } as never);
    assert.equal(c.maj?.timezone, null);
    assert.equal(c.maj?.timezoneSource, null);
  });

  it('un fuseau posé À LA MAIN survit au déménagement', async () => {
    const c = armer({ timezone: 'Indian/Reunion', timezoneSource: 'manual' });
    await locationService.updateLocation('p1', 'l1', {
      countryCode: 'US', postalCode: '10001', city: 'New York',
    } as never);
    assert.equal(c.maj?.timezone, undefined, 'le patch ne touche pas au fuseau');
  });

  it('un déménagement qu’on SAIT trancher met à jour le fuseau', async () => {
    const c = armer({ timezone: 'Europe/Paris', timezoneSource: 'automatic' });
    await locationService.updateLocation('p1', 'l1', {
      postalCode: '97400', city: 'Saint-Denis',
    } as never);
    assert.equal(c.maj?.timezone, 'Indian/Reunion');
    assert.equal(c.maj?.timezoneSource, 'automatic');
  });

  it('une saisie manuelle invalide est REFUSÉE, pas ignorée', async () => {
    armer();
    await assert.rejects(
      () => locationService.updateLocation('p1', 'l1', { timezone: '+04:00' } as never),
      /IANA/,
    );
  });
});
