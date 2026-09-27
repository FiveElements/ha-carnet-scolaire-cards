import { describe, expect, it } from 'vitest';
import { latestFirst, listAttr } from '../src/core/list';

describe('listAttr', () => {
  it('rend le tableau tel quel', () => {
    expect(listAttr<number>([1, 2, 3])).toEqual([1, 2, 3]);
  });

  it('rend un tableau vide pour une valeur absente', () => {
    expect(listAttr(undefined)).toEqual([]);
    expect(listAttr(null)).toEqual([]);
  });

  it("rend un tableau vide plutôt que de lever sur une valeur qui n'est pas un tableau", () => {
    // Le cas qui faisait disparaître trois cartes entières : un attribut que
    // l'intégration publie sous une forme inattendue levait dans render().
    expect(listAttr({ a: 1 })).toEqual([]);
    expect(listAttr('deux')).toEqual([]);
    expect(listAttr(42)).toEqual([]);
  });

  it('écarte les trous du tableau', () => {
    // Un seul élément nul suffisait à faire lever un comparateur de tri.
    expect(listAttr<number>([1, null, 2, undefined, 3])).toEqual([1, 2, 3]);
  });
});

describe('latestFirst', () => {
  const items = ['a', 'b', 'c', 'd'];

  it('rend tout, le plus récent en tête, sans limite', () => {
    expect(latestFirst<string>(items)).toEqual(['d', 'c', 'b', 'a']);
  });

  it('tronque aux plus récents', () => {
    expect(latestFirst<string>(items, 2)).toEqual(['d', 'c']);
  });

  it('rend une liste vide pour une limite de zéro', () => {
    // Les deux implémentations qu'on remplace divergeaient ici : slice(-0)
    // vaut slice(0), donc l'une rendait TOUT là où l'autre ne rendait rien.
    expect(latestFirst<string>(items, 0)).toEqual([]);
  });

  it('traite une limite plus grande que la liste sans se plaindre', () => {
    expect(latestFirst<string>(items, 99)).toEqual(['d', 'c', 'b', 'a']);
  });

  it('rend tout pour une limite nulle ou non finie, comme le commentaire le promet', () => {
    // `null < 0` est faux et `len - null` vaut `len` : sans garde, un
    // `limit: null` venu du YAML rendait une liste vide.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- un YAML peut porter `limit: null`, que le type ne décrit pas : c'est précisément le cas testé.
    expect(latestFirst<string>(items, null as unknown as number)).toEqual(['d', 'c', 'b', 'a']);
    expect(latestFirst<string>(items, Number.NaN)).toEqual(['d', 'c', 'b', 'a']);
  });

  it("rend une liste vide pour une valeur qui n'est pas un tableau", () => {
    expect(latestFirst({ a: 1 }, 3)).toEqual([]);
  });
});
