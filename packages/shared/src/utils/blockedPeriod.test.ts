import { describe, expect, it } from 'vitest';
import {
  blockedWindowForDay,
  endHhmmToMinutes,
  hhmmToMinutes,
  isBlockedPeriodValid,
} from './blockedPeriod';

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

describe('blockedWindowForDay', () => {
  const jour = (n: number) => new Date(2026, 7, n);
  /** Fermeture du 18 au 22 août, 09:00 → 12:00. */
  const periode = (spanMode?: 'continuous' | 'daily') => ({
    allDay: false,
    startDate: jour(18),
    endDate: jour(22),
    startTime: '09:00',
    endTime: '12:00',
    spanMode,
  });

  it('ne retient rien hors de la plage de dates', () => {
    expect(blockedWindowForDay(periode(), jour(17))).toBeNull();
    expect(blockedWindowForDay(periode(), jour(23))).toBeNull();
  });

  it('prend la journée entière quand allDay', () => {
    expect(
      blockedWindowForDay({ ...periode(), allDay: true }, jour(20))
    ).toEqual({ startMin: 0, endMin: 1440 });
  });

  describe('absence continue', () => {
    it('part de l’heure de début jusqu’à minuit le premier jour', () => {
      expect(blockedWindowForDay(periode('continuous'), jour(18))).toEqual({
        startMin: 540,
        endMin: 1440,
      });
    });

    it('prend les jours intercalaires en entier', () => {
      expect(blockedWindowForDay(periode('continuous'), jour(20))).toEqual({
        startMin: 0,
        endMin: 1440,
      });
    });

    it('s’arrête à l’heure de fin le dernier jour', () => {
      expect(blockedWindowForDay(periode('continuous'), jour(22))).toEqual({
        startMin: 0,
        endMin: 720,
      });
    });

    it('se comporte comme continu quand spanMode est absent', () => {
      expect(blockedWindowForDay(periode(), jour(20))).toEqual(
        blockedWindowForDay(periode('continuous'), jour(20))
      );
    });
  });

  describe('fermeture quotidienne', () => {
    it('rejoue la même tranche chaque jour, bornes comprises', () => {
      for (const j of [18, 19, 20, 21, 22]) {
        expect(blockedWindowForDay(periode('daily'), jour(j))).toEqual({
          startMin: 540,
          endMin: 720,
        });
      }
    });

    it('laisse le reste de la journée libre, contrairement au mode continu', () => {
      const quotidien = blockedWindowForDay(periode('daily'), jour(20));
      const continu = blockedWindowForDay(periode('continuous'), jour(20));
      expect(quotidien).not.toEqual(continu);
    });
  });

  it('sur un seul jour, les deux lectures se confondent', () => {
    const unJour = { ...periode(), startDate: jour(18), endDate: jour(18) };
    expect(blockedWindowForDay(unJour, jour(18))).toEqual({ startMin: 540, endMin: 720 });
    expect(blockedWindowForDay({ ...unJour, spanMode: 'daily' }, jour(18))).toEqual({
      startMin: 540,
      endMin: 720,
    });
  });

  it('une fin à minuit vaut fin de journée, jamais début', () => {
    const soir = { ...periode('daily'), startTime: '22:00', endTime: '00:00' };
    expect(blockedWindowForDay(soir, jour(20))).toEqual({ startMin: 1320, endMin: 1440 });
  });

  it('ne retient rien si les heures manquent hors journée entière', () => {
    expect(
      blockedWindowForDay({ ...periode(), startTime: null, endTime: null }, jour(20))
    ).toBeNull();
  });
});
