/**
 * Moteur de créneaux — la correction de performance ne change AUCUN résultat.
 *
 *   TZ=Europe/Paris node --experimental-strip-types --test packages/shared/src/utils/moteur-performance.node.test.mjs
 *
 * Deux leviers, deux preuves :
 *
 * 1. Le formateur `Intl` est désormais construit une fois par fuseau et
 *    réutilisé. On vérifie que les conversions rendent exactement ce qu'elles
 *    rendaient, y compris en alternant les fuseaux, et qu'un fuseau invalide
 *    lève toujours.
 *
 * 2. Les fenêtres bloquées sont calculées une fois par JOUR au lieu d'une fois
 *    par créneau. C'est juste parce que `blockedWindowForDay` ne lit l'instant
 *    du créneau que pour en tirer le jour. On le vérifie par propriété : pour
 *    des blocages et des créneaux tirés au hasard, la fenêtre calculée depuis
 *    n'importe quel instant du jour est la même.
 *
 * La preuve de bout en bout a été faite sur le vrai moteur et des données
 * réelles (8 comptes, 606 jours, 12 729 créneaux, 0 écart) — voir le commit.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { register } from 'node:module';
import { jourLocal, heureLocale, minutesLocales, bornesDeJourLocal, ajouterJours } from './fuseaux.ts';

// `blockedPeriod.ts` importe `./fuseaux` SANS extension (c'est la forme que
// veulent Next et Metro), ce que `node --test` ne résout pas. Plutôt que de
// tester une copie, on apprend au chargeur à essayer `.ts` pour un import
// relatif — uniquement pour les imports faits APRÈS cet enregistrement.
register('data:text/javascript,' + encodeURIComponent(`
  export async function resolve(specifier, context, next) {
    try { return await next(specifier, context); }
    catch (e) {
      if (specifier.startsWith('.') && !/\\.[cm]?[jt]s$/.test(specifier)) return next(specifier + '.ts', context);
      throw e;
    }
  }
`));
const { blockedWindowForDay } = await import('./blockedPeriod.ts');

const FUSEAUX = ['Europe/Paris', 'America/Los_Angeles', 'Indian/Reunion', 'America/Santiago', 'Asia/Tokyo', 'Pacific/Chatham'];

/** La conversion de référence : un formateur NEUF, comme avant la correction. */
const reference = (d, tz) => {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      .formatToParts(d).filter((x) => x.type !== 'literal').map((x) => [x.type, x.value]),
  );
  return { jour: `${p.year}-${p.month}-${p.day}`, heure: `${p.hour}:${p.minute}` };
};

describe('1. un formateur par fuseau : mêmes résultats', () => {
  it('10 000 instants, six fuseaux entremêlés — identiques à un formateur neuf', () => {
    let graine = 42;
    const alea = () => (graine = (graine * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
    for (let i = 0; i < 10_000; i++) {
      const d = new Date(Date.UTC(2026, 0, 1) + Math.floor(alea() * 400 * 86_400_000));
      const tz = FUSEAUX[i % FUSEAUX.length];
      const attendu = reference(d, tz);
      assert.equal(jourLocal(d, tz), attendu.jour, `${tz} ${d.toISOString()}`);
      assert.equal(heureLocale(d, tz), attendu.heure, `${tz} ${d.toISOString()}`);
    }
  });
  it('un fuseau invalide lève toujours — et n’empoisonne pas le cache', () => {
    assert.throws(() => jourLocal(new Date(), 'Pas/UnFuseau'));
    assert.throws(() => jourLocal(new Date(), 'Pas/UnFuseau'), 'relevé à nouveau, pas mis en cache');
    assert.equal(jourLocal(new Date(Date.UTC(2026, 4, 9, 12)), 'Europe/Paris'), '2026-05-09');
  });
  it('le cache rend bien le même travail plus rapide (garde contre un retour en arrière)', () => {
    const d = new Date(Date.UTC(2026, 4, 9, 12));
    const t0 = performance.now();
    for (let i = 0; i < 20_000; i++) minutesLocales(d, 'Europe/Paris');
    const avecCache = performance.now() - t0;
    const t1 = performance.now();
    for (let i = 0; i < 2_000; i++) reference(d, 'Europe/Paris');
    const sansCache10pc = performance.now() - t1;
    // 20 000 appels avec cache doivent coûter moins que 2 000 sans : > 10×.
    assert.ok(avecCache < sansCache10pc, `avec cache ${avecCache.toFixed(1)} ms pour 20 000 ; sans cache ${sansCache10pc.toFixed(1)} ms pour 2 000`);
  });
});

describe('2. la fenêtre d’un blocage ne dépend que du JOUR du créneau', () => {
  it('propriété : pour 3 000 couples (blocage, jour), tout instant du jour donne la même fenêtre', () => {
    let graine = 7;
    const alea = () => (graine = (graine * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
    const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    for (let i = 0; i < 3_000; i++) {
      const tz = FUSEAUX[i % FUSEAUX.length];
      const debutJour = ajouterJours('2026-03-01', Math.floor(alea() * 300));
      const duree = Math.floor(alea() * 4);
      const allDay = alea() < 0.3;
      const sMin = Math.floor(alea() * 1380), eMin = Math.floor(alea() * 1440);
      const bloc = {
        allDay,
        startDate: bornesDeJourLocal(debutJour, tz).debut,
        endDate: bornesDeJourLocal(ajouterJours(debutJour, duree), tz).debut,
        startTime: allDay ? null : hhmm(sMin),
        endTime: allDay ? null : hhmm(eMin),
        spanMode: alea() < 0.5 ? 'daily' : 'continuous',
      };
      const jour = ajouterJours(debutJour, Math.floor(alea() * (duree + 3)) - 1);
      const { debut, fin } = bornesDeJourLocal(jour, tz);
      const repere = blockedWindowForDay(bloc, debut, tz);
      // Trois instants quelconques du même jour local.
      for (const f of [0.01, 0.5, 0.99]) {
        const instant = new Date(debut.getTime() + f * (fin.getTime() - debut.getTime()));
        assert.deepEqual(blockedWindowForDay(bloc, instant, tz), repere, `${tz} ${jour}`);
      }
    }
  });
});

describe('3. le moteur mémorise les fenêtres par jour, sans changer la comparaison', () => {
  const ici = dirname(fileURLToPath(import.meta.url));
  const moteur = readFileSync(resolve(ici, '../../../firebase/src/services/scheduling.service.ts'), 'utf8');
  const fuseaux = readFileSync(resolve(ici, './fuseaux.ts'), 'utf8');
  it('les deux boucles chaudes passent une mémoire propre à leur calcul', () => {
    assert.equal((moteur.match(/const memoFenetres = new Map<string, BlockedWindow\[\]>\(\);/g) ?? []).length, 2);
    assert.match(moteur, /relevantBlockedSlots,\s*fuseau,\s*memoFenetres,/);
    assert.match(moteur, /relevantBlocked, fuseau, memoFenetres\)/);
  });
  it('la comparaison est la même, au caractère près', () => {
    const corps = moteur.slice(moteur.indexOf('private isTimeBlockedBySlots('), moteur.indexOf('private isTimeBlockedBySlot('));
    assert.match(corps, /const slotEndMin = finMin === 0 \? 24 \* 60 : finMin;/);
    assert.match(corps, /slotStartMin < f\.endMin && f\.startMin < slotEndMin/);
    assert.match(corps, /if \(!memo\) return blockedSlots\.some\(\(bs\) => this\.isTimeBlockedBySlot\(start, end, bs, fuseau\)\);/, 'sans mémoire : l’ancien chemin');
  });
  it('partiesLocales réutilise un formateur par fuseau', () => {
    assert.match(fuseaux, /const FORMATEURS = new Map<string, Intl\.DateTimeFormat>\(\);/);
    assert.match(fuseaux, /const parts = formateurDe\(fuseau\)\.formatToParts\(instant\);/);
  });
});
