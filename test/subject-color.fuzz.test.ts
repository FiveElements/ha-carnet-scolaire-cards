import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { subjectColor, subjectAccent } from '../src/core/subject-color';

/**
 * Tests par propriétés de la seule frontière de confiance du rendu.
 *
 * `subject-color.test.ts` énumère les refus qu'on a pensé à écrire ; ce
 * fichier tire des chaînes au hasard pour trouver ceux qu'on n'a pas pensé à
 * écrire. La propriété vérifiée est celle qui compte pour l'attribut `style` :
 * quoi qu'arrive du serveur ou de la configuration, ce qui sort est soit
 * `undefined`, soit un dièse suivi de trois ou six chiffres hexadécimaux — donc
 * ni point-virgule, ni parenthèse, ni deux-points, rien qui ajoute une
 * propriété CSS.
 */
const SAFE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const isSafe = (out: string | undefined): boolean => out === undefined || SAFE.test(out);

describe('subjectColor — propriétés', () => {
  it('ne rend jamais autre chose que de l’hexadécimal strict, sur toute chaîne', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'binary', maxLength: 64 }), (s) => isSafe(subjectColor(s))),
      {
        numRuns: 2000,
      }
    );
  });

  it('ne rend jamais autre chose que de l’hexadécimal strict, sur toute valeur', () => {
    fc.assert(
      fc.property(fc.anything(), (v) => isSafe(subjectColor(v))),
      { numRuns: 1000 }
    );
  });

  it('refuse une couleur valide suivie de n’importe quel suffixe non blanc', () => {
    const hex = fc.stringMatching(/^#[0-9a-f]{6}$/);
    // Un suffixe fait seulement de blancs est retiré par `trim` : il est exclu
    // du tirage, puisque la couleur reste alors légitime.
    const suffix = fc.string({ minLength: 1, maxLength: 32 }).filter((s) => s.trim() !== '');
    fc.assert(
      fc.property(hex, suffix, (h, s) => {
        expect(subjectColor(h + s)).toBeUndefined();
      })
    );
  });

  it('accepte toute couleur strictement hexadécimale, avec ou sans dièse', () => {
    const digits = fc.oneof(
      fc.stringMatching(/^[0-9a-fA-F]{3}$/),
      fc.stringMatching(/^[0-9a-fA-F]{6}$/)
    );
    fc.assert(
      fc.property(digits, fc.boolean(), (d, withHash) => {
        expect(subjectColor(withHash ? `#${d}` : d)).toBe(`#${d}`);
      })
    );
  });

  it('subjectAccent hérite de la même garantie, par la table comme par le serveur', () => {
    fc.assert(
      fc.property(
        fc.anything(),
        fc.string(),
        fc.dictionary(fc.string(), fc.string({ unit: 'binary' })),
        (published, subject, table) => isSafe(subjectAccent(published, subject, table))
      ),
      { numRuns: 1000 }
    );
  });
});
