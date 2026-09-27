import { describe, expect, it } from 'vitest';
import { localize } from '../src/localize';
import fr from '../src/localize/fr.json';
import itCatalog from '../src/localize/it.json';
import pt from '../src/localize/pt.json';
import es from '../src/localize/es.json';

describe('localize', () => {
  it('résout un chemin pointé', () => {
    expect(localize('common.unavailable')).toBe('Donnée pas encore collectée.');
  });
  it('substitue les variables', () => {
    expect(localize('prochain_cours.room', { room: 'B12' })).toBe('Salle B12');
  });
  it('rend le chemin lui-même quand la chaîne manque', () => {
    expect(localize('common.inexistante')).toBe('common.inexistante');
  });
  it('retombe sur le français pour une langue inconnue', () => {
    expect(localize('common.unavailable', undefined, 'de')).toBe('Donnée pas encore collectée.');
  });

  it('retombe sur la langue de base d’une variante régionale avant le français', () => {
    // Home Assistant publie `pt-BR` et `es-419`, deux traductions distinctes
    // de son interface : sans ce repli, toute la carte parlait français
    // pendant que `Intl` mettait les dates en portugais.
    expect(localize('common.unavailable', undefined, 'pt-BR')).toBe(
      localize('common.unavailable', undefined, 'pt')
    );
    expect(localize('common.unavailable', undefined, 'es-419')).toBe(
      localize('common.unavailable', undefined, 'es')
    );
    expect(localize('common.unavailable', undefined, 'pt-BR')).not.toBe(
      localize('common.unavailable', undefined, 'fr')
    );
  });
  it('traduit dans les trois autres langues', () => {
    expect(localize('menu.main_meal', undefined, 'it')).toBe('Piatto');
    expect(localize('menu.main_meal', undefined, 'pt')).toBe('Prato');
    expect(localize('menu.main_meal', undefined, 'es')).toBe('Plato');
  });
});

const byLocale = (a: string, b: string): number => a.localeCompare(b);

// oxlint-disable-next-line unicorn/no-array-sort -- `sort` mute son receveur, d'où la règle ; ici le receveur est une copie fraîche que personne d'autre ne détient. `toSorted` imposerait `lib: ES2023` à tout le projet — donc à src/, où il légaliserait en silence des méthodes d'exécution que le bundle ne peut pas polyfiller — pour une commodité de test qui ne s'expédie jamais.
const sortedCopy = <T>(xs: readonly T[], cmp?: (a: T, b: T) => number): T[] => [...xs].sort(cmp);

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

const paths = (d: unknown, prefix = ''): string[] =>
  isRecord(d)
    ? Object.entries(d).flatMap(([k, v]) =>
        typeof v === 'string' ? [`${prefix}${k}`] : paths(v, `${prefix}${k}.`)
      )
    : [];

const vars = (d: unknown): Record<string, string[]> =>
  Object.fromEntries(
    paths(d).map((path) => {
      const value = path
        .split('.')
        .reduce<unknown>((acc, part) => (isRecord(acc) ? acc[part] : undefined), d);
      return [
        path,
        sortedCopy(
          [...String(value).matchAll(/\{(\w+)\}/g)].map((m) => m[1] ?? ''),
          byLocale
        ),
      ];
    })
  );

/**
 * Une clé présente en français et absente d'une autre langue ne se manifeste
 * qu'à l'exécution, chez un utilisateur dont personne ici ne lit la langue.
 * Ce test est ce qui rend la contrainte tenable quand chaque carte ajoute
 * leurs chaînes.
 */
describe('parité des catalogues', () => {
  const reference = sortedCopy(paths(fr), byLocale);

  it.each([
    ['it', itCatalog],
    ['pt', pt],
    ['es', es],
  ])('%s a exactement les mêmes clés que le français', (_lang, catalog) => {
    expect(sortedCopy(paths(catalog), byLocale)).toEqual(reference);
  });

  it.each([
    ['it', itCatalog],
    ['pt', pt],
    ['es', es],
  ])('%s reproduit les mêmes variables que le français', (_lang, catalog) => {
    expect(vars(catalog)).toEqual(vars(fr));
  });
});
