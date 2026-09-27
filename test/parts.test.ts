import { describe, expect, it } from 'vitest';
import { render } from 'lit';
import { listRow } from '../src/core/ui/parts';

const rowOf = (accent: string | null | undefined): HTMLElement => {
  const host = document.createElement('div');
  render(listRow({ primary: 'Maths', accent }), host);
  const row = host.querySelector('.row');
  if (!(row instanceof HTMLElement)) throw new Error('aucune ligne rendue');
  return row;
};

describe('listRow — l’accent de couleur', () => {
  it('pose la couleur filtrée sur une ligne colorée', () => {
    const row = rowOf('#1e88e5');
    expect(row.classList.contains('accented')).toBe(true);
    expect(row.style.getPropertyValue('--pronote-subject-color').trim()).toBe('#1e88e5');
  });

  it('refiltre elle-même l’accent, au lieu de faire confiance à l’appelant', () => {
    // La valeur atteint un attribut `style` : une chaîne non filtrée y
    // ajouterait des propriétés CSS arbitraires.
    const row = rowOf('#fff; position: fixed');
    expect(row.getAttribute('style') ?? '').not.toContain('position');
    expect(row.classList.contains('accented')).toBe(true);
    expect(row.classList.contains('accent-neutre')).toBe(true);
  });

  it('marque neutre une ligne sans couleur, pour qu’elle n’hérite pas de celle d’un ancêtre', () => {
    // La propriété personnalisée est HÉRITÉE : un thème qui la pose plus haut
    // colorait toutes les lignes sans couleur.
    const row = rowOf(null);
    expect(row.classList.contains('accented')).toBe(true);
    expect(row.classList.contains('accent-neutre')).toBe(true);
    expect(rowOf('#1e88e5').classList.contains('accent-neutre')).toBe(false);
  });

  it('ne réserve aucune gouttière pour une liste qui n’est pas codée par couleur', () => {
    const row = rowOf(undefined);
    expect(row.classList.contains('accented')).toBe(false);
    expect(row.textContent).toContain('Maths');
  });
});
