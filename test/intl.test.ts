import { afterEach, describe, expect, it } from 'vitest';
import { dateTimeFormat, numberFormat, relativeTimeFormat } from '../src/core/intl';
import { formatDayLabel, formatDuration, formatRelative, formatTime } from '../src/core/format';
import { resolveTimeZone } from '../src/core/base-card';

const Original = Intl.DateTimeFormat;

/** Pose un constructeur sur `Intl` sans conversion de type. */
const poser = (valeur: unknown): void => {
  Object.defineProperty(Intl, 'DateTimeFormat', { value: valeur, writable: true, configurable: true });
};

afterEach(() => {
  poser(Original);
});

/** Remplace le constructeur par un compteur, le temps d'un test. */
const compterConstructions = (): { n: number } => {
  const compte = { n: 0 };
  class Comptant extends Original {
    constructor(...args: ConstructorParameters<typeof Original>) {
      super(...args);
      compte.n++;
    }
  }
  poser(Comptant);
  return compte;
};

describe('les formateurs Intl sont construits une fois, pas à chaque rendu', () => {
  it('rend le même formateur pour les mêmes langue et options', () => {
    const a = dateTimeFormat('fr', { hour: '2-digit', timeZone: 'Europe/Paris' });
    const b = dateTimeFormat('fr', { hour: '2-digit', timeZone: 'Europe/Paris' });
    expect(a).toBe(b);
    // Assertion positive appariée : des options différentes ne se confondent pas.
    expect(dateTimeFormat('fr', { hour: '2-digit', timeZone: 'America/Martinique' })).not.toBe(a);
    expect(dateTimeFormat('it', { hour: '2-digit', timeZone: 'Europe/Paris' })).not.toBe(a);
    expect(relativeTimeFormat('fr', { numeric: 'auto' })).toBe(relativeTimeFormat('fr', { numeric: 'auto' }));
    expect(numberFormat('fr', { style: 'unit', unit: 'hour' })).toBe(
      numberFormat('fr', { style: 'unit', unit: 'hour' })
    );
  });

  it('ne construit plus aucun formateur de dates au centième appel', () => {
    const tz = 'Pacific/Noumea';
    formatTime('2026-09-08T08:30:00+02:00', 'es', tz);
    formatDayLabel('2026-09-08T08:30:00+02:00', 'es', tz);
    formatDayLabel('2026-09-08', 'es', tz);
    const hass = { locale: { time_zone: 'server' }, config: { time_zone: tz } };
    resolveTimeZone(hass);
    const compte = compterConstructions();
    for (let i = 0; i < 100; i++) {
      formatTime('2026-09-08T08:30:00+02:00', 'es', tz);
      formatDayLabel('2026-09-08T08:30:00+02:00', 'es', tz);
      formatDayLabel('2026-09-08', 'es', tz);
      resolveTimeZone(hass);
    }
    expect(compte.n).toBe(0);
    expect(formatTime('2026-09-08T08:30:00+02:00', 'es', tz)).toBe('17:30');
  });

  it('ne met pas en cache une construction qui échoue', () => {
    // Un fuseau que le moteur refuse doit continuer de lever à chaque appel :
    // c'est sur cette levée que `resolveTimeZone` s'appuie pour l'écarter.
    expect(() => dateTimeFormat('fr', { timeZone: 'Pas/UnFuseau' })).toThrow(RangeError);
    expect(() => dateTimeFormat('fr', { timeZone: 'Pas/UnFuseau' })).toThrow(RangeError);
  });

  it('garde les mêmes rendus qu’avant', () => {
    expect(formatRelative('2026-09-08T08:30:00Z', 'fr', new Date('2026-09-08T08:00:00Z'))).toContain(
      '30'
    );
    expect(formatDuration(135, 'fr')).toBe('2 h 15');
  });
});
