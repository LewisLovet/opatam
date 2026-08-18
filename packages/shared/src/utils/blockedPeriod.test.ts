import { describe, expect, it } from 'vitest';
import { endHhmmToMinutes, hhmmToMinutes, isBlockedPeriodValid } from './blockedPeriod';

/** Raccourci : période sur UN SEUL jour, hors journée entière. */
const sameDay = (startTime: string, endTime: string) =>
  isBlockedPeriodValid({ allDay: false, sameDay: true, startTime, endTime });

describe('hhmmToMinutes / endHhmmToMinutes', () => {
  it('convertit une heure en minutes depuis minuit', () => {
    expect(hhmmToMinutes('00:00')).toBe(0);
    expect(hhmmToMinutes('09:30')).toBe(570);
    expect(hhmmToMinutes('23:59')).toBe(1439);
  });

  it('en FIN de période, « 00:00 » désigne minuit de fin de journée', () => {
    expect(endHhmmToMinutes('00:00')).toBe(1440);
    expect(endHhmmToMinutes('22:00')).toBe(1320);
  });
});

describe('isBlockedPeriodValid — même jour', () => {
  it('refuse une fin antérieure au début', () => {
    expect(sameDay('14:00', '13:00')).toBe(false);
  });

  it('refuse des bornes identiques', () => {
    expect(sameDay('14:00', '14:00')).toBe(false);
  });

  it('refuse 00:00 → 00:00', () => {
    // Le piège : convertir la fin en 1440 AVANT de comparer les bornes
    // ferait passer cette saisie ambiguë pour une journée valide. C'est
    // exactement ce qui échappait à l'écran d'édition.
    expect(sameDay('00:00', '00:00')).toBe(false);
  });

  it('accepte 22:00 → 00:00 (minuit = fin de journée)', () => {
    expect(sameDay('22:00', '00:00')).toBe(true);
  });

  it('accepte une période normale', () => {
    expect(sameDay('13:00', '14:00')).toBe(true);
    expect(sameDay('09:00', '18:30')).toBe(true);
  });

  it('accepte une période d’une minute', () => {
    expect(sameDay('09:00', '09:01')).toBe(true);
  });
});

describe('isBlockedPeriodValid — autres cas', () => {
  it('accepte n’importe quelles heures sur des jours DIFFÉRENTS', () => {
    // Bloquer du lundi 18 h au mercredi 9 h est légitime.
    expect(
      isBlockedPeriodValid({ allDay: false, sameDay: false, startTime: '18:00', endTime: '09:00' }),
    ).toBe(true);
    expect(
      isBlockedPeriodValid({ allDay: false, sameDay: false, startTime: '00:00', endTime: '00:00' }),
    ).toBe(true);
  });

  it('accepte une journée entière, quelles que soient les heures', () => {
    expect(
      isBlockedPeriodValid({ allDay: true, sameDay: true, startTime: '14:00', endTime: '13:00' }),
    ).toBe(true);
    expect(isBlockedPeriodValid({ allDay: true, sameDay: true })).toBe(true);
  });

  it('refuse une période horaire sans heures', () => {
    expect(isBlockedPeriodValid({ allDay: false, sameDay: true })).toBe(false);
    expect(
      isBlockedPeriodValid({ allDay: false, sameDay: true, startTime: '09:00', endTime: null }),
    ).toBe(false);
  });
});

describe('spanMode', () => {
  it('accepte une inversion sur une période continue (départ vendredi soir, retour lundi matin)', () => {
    expect(
      isBlockedPeriodValid({ allDay: false, sameDay: false, startTime: '18:00', endTime: '09:00' }),
    ).toBe(true);
    expect(
      isBlockedPeriodValid({
        allDay: false, sameDay: false, startTime: '18:00', endTime: '09:00', spanMode: 'continuous',
      }),
    ).toBe(true);
  });

  it('refuse une inversion quand la tranche est rejouée chaque jour', () => {
    expect(
      isBlockedPeriodValid({
        allDay: false, sameDay: false, startTime: '18:00', endTime: '09:00', spanMode: 'daily',
      }),
    ).toBe(false);
  });

  it('accepte une tranche quotidienne cohérente', () => {
    expect(
      isBlockedPeriodValid({
        allDay: false, sameDay: false, startTime: '12:00', endTime: '14:00', spanMode: 'daily',
      }),
    ).toBe(true);
  });
});
