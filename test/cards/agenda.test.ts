import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineCard } from '../../src/core/registry';
import { SPEC } from '../../src/cards/agenda';
import { makeHass } from '../fixtures/hass';
import { mountCard, text } from '../fixtures/mount';

declare global {
  interface HTMLElementTagNameMap {
    'carnet-scolaire-agenda': HTMLElement & {
      setConfig(c: unknown): void;
      hass: unknown;
      readonly updateComplete: Promise<unknown>;
    };
  }
}

beforeAll(() => {
  defineCard(SPEC);
});

// Le « maintenant » de toute la suite : lundi 16 novembre 2026, 10 h à Paris.
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-16T09:00:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
});

/** Les formes du contrat : voir `test/fixtures/FORMES.md`, section agenda. */
const ARRET = {
  key: 'evt_arret',
  title: 'Arrêt des notes - trimestre 1',
  start: '2026-11-20',
  end: '2026-11-21',
  all_day: true,
  category: 'Évènement',
  color: '#2d7dd2',
  is_class_council: false,
  is_holiday: false,
};
const CONSEIL = {
  key: 'evt_conseil',
  title: 'Conseil de classe 5E1',
  start: '2026-12-01T17:15:00+01:00',
  end: '2026-12-01T18:30:00+01:00',
  all_day: false,
  category: 'Conseil de classe',
  color: '#1fa3a3',
  is_class_council: true,
  is_holiday: false,
  location: 'Salle 2.2',
  audience: 'Parents délégués, Professeurs',
};
const VACANCES = {
  key: 'evt_vacances',
  title: 'Vacances de Noël',
  start: '2026-12-19',
  end: '2027-01-04',
  all_day: true,
  category: 'Vacances et jours fériés',
  color: '#e85d9a',
  is_class_council: false,
  is_holiday: true,
};

const agenda = (
  items: unknown[],
  state = '2026-11-20T00:00:00+01:00',
  extra: Record<string, unknown> = {}
) =>
  makeHass([
    {
      key: 'sensor:next_school_event',
      entity_id: 'sensor.abc_prochain_evenement',
      device: 'dev_enfant',
      state,
      attributes: { fetched_at: '2026-11-16T06:00:00+01:00', stale: false, items, ...extra },
    },
  ]);

const mount = (hass: ReturnType<typeof makeHass>, config: Record<string, unknown> = {}) =>
  mountCard('carnet-scolaire-agenda', { device_id: 'dev_enfant', ...config }, hass);

describe('carte agenda', () => {
  it("affiche chaque évènement avec sa date dans la forme de l'appli", async () => {
    const el = await mount(agenda([ARRET, CONSEIL, VACANCES]));
    const t = text(el);
    expect(t).toContain('Arrêt des notes - trimestre 1');
    expect(t).toContain('Le 20 novembre');
    expect(t).toContain('Conseil de classe 5E1');
    expect(t).toContain('Le 1 décembre de 17:15 à 18:30');
    expect(t).toContain('Vacances de Noël');
    // La fin publiée est EXCLUSIVE (le 4 janvier) : le dernier jour est le 3.
    expect(t).toContain('Du 19 décembre au 3 janvier');
    expect(t).not.toContain('4 janvier');
  });

  it('pose la date en page de calendrier, le libellé long au survol', async () => {
    const el = await mount(agenda([ARRET]));
    const page = el.shadowRoot?.querySelector('.primary time.page-calendrier');
    expect(page?.querySelector('.page-calendrier-mois')?.textContent).toBe('nov.');
    expect(page?.querySelector('.page-calendrier-jour')?.textContent).toBe('20');
    expect(page?.getAttribute('title')).toBe('Le 20 novembre');
  });

  it('montre la famille, le public et le lieu, et les masque sur demande', async () => {
    const shown = text(await mount(agenda([CONSEIL])));
    expect(shown).toContain('Conseil de classe · Parents délégués, Professeurs');
    expect(shown).toContain('Salle 2.2');
    const hidden = text(await mount(agenda([CONSEIL]), { show_category: false }));
    expect(hidden).toContain('Conseil de classe 5E1');
    expect(hidden).not.toContain('Parents délégués');
  });

  it('colore le liseré à la couleur de la famille, et refuse une couleur qui n’est pas hexadécimale', async () => {
    const el = await mount(agenda([ARRET, { ...CONSEIL, color: 'red; background: url(x)' }]));
    const rows = [...(el.shadowRoot?.querySelectorAll('.row.accented') ?? [])];
    expect(rows).toHaveLength(2);
    expect(rows[0]?.getAttribute('style')).toContain('#2d7dd2');
    // La couleur refusée réserve la gouttière sans rien écrire dans `style`.
    expect(rows[1]?.getAttribute('style') ?? '').not.toContain('red');
    expect(rows[1]?.classList.contains('accent-neutre')).toBe(true);
  });

  it('masque les vacances sur demande, sur le booléen et pas sur le libellé', async () => {
    const el = await mount(
      agenda([ARRET, VACANCES, { ...CONSEIL, category: 'Vacances et jours fériés' }]),
      { show_holidays: false }
    );
    const t = text(el);
    expect(t).not.toContain('Vacances de Noël');
    // Une catégorie au libellé trompeur ne suffit pas à être masquée.
    expect(t).toContain('Conseil de classe 5E1');
    expect(t).toContain('Arrêt des notes');
  });

  it('retire un évènement terminé sans attendre la collecte suivante', async () => {
    const fini = {
      ...CONSEIL,
      title: 'Réunion parents-professeurs',
      start: '2026-11-16T08:00:00+01:00',
      end: '2026-11-16T09:30:00+01:00',
    };
    const enCours = {
      ...VACANCES,
      title: 'Pont du 11 novembre',
      start: '2026-11-11',
      end: '2026-11-17',
    };
    const t = text(await mount(agenda([fini, enCours, ARRET])));
    expect(t).not.toContain('Réunion parents-professeurs');
    // Commencé mais pas fini : il reste, et sa période se lit en entier.
    expect(t).toContain('Pont du 11 novembre');
    expect(t).toContain('Du 11 novembre au 16 novembre');
    expect(t).toContain('Arrêt des notes');
  });

  it('respecte limit', async () => {
    const t = text(await mount(agenda([ARRET, CONSEIL, VACANCES]), { limit: 2 }));
    expect(t).toContain('Arrêt des notes');
    expect(t).toContain('Conseil de classe 5E1');
    expect(t).not.toContain('Vacances de Noël');
  });

  it("affiche la liste quand il ne reste que des vacances et que l'état vaut unknown", async () => {
    const t = text(await mount(agenda([VACANCES], 'unknown')));
    expect(t).toContain('Vacances de Noël');
  });

  it('dit « aucun évènement » quand la collecte a eu lieu et que la liste est vide', async () => {
    const t = text(await mount(agenda([], 'unknown')));
    expect(t).toContain('Aucun évènement à venir.');
  });

  it('distingue le vide « hors vacances » du vide tout court', async () => {
    const t = text(await mount(agenda([VACANCES]), { show_holidays: false }));
    expect(t).toContain('Aucun évènement à venir en dehors des vacances.');
    expect(t).not.toContain('Vacances de Noël');
  });

  it('ne confond pas « pas encore collectée » avec une liste vide', async () => {
    const hass = makeHass([
      {
        key: 'sensor:next_school_event',
        entity_id: 'sensor.abc_prochain_evenement',
        device: 'dev_enfant',
        state: 'unknown',
        attributes: {},
      },
    ]);
    const t = text(await mount(hass));
    expect(t).not.toContain('Aucun évènement');
    expect(t).toContain('Donnée pas encore collectée.');
  });

  it('écarte un élément sans titre ou sans date lisible, sans casser le reste', async () => {
    const t = text(
      await mount(
        agenda([
          { ...ARRET, title: '' },
          { ...CONSEIL, start: 'pas une date' },
          VACANCES,
          'x',
          null,
        ])
      )
    );
    expect(t).toContain('Vacances de Noël');
    expect(t).not.toContain('Conseil de classe 5E1');
  });

  it('parle la langue de Home Assistant', async () => {
    const hass = makeHass(
      [
        {
          key: 'sensor:next_school_event',
          entity_id: 'sensor.abc_prochain_evenement',
          device: 'dev_enfant',
          state: '2026-11-20T00:00:00+01:00',
          attributes: { fetched_at: '2026-11-16T06:00:00+01:00', items: [VACANCES] },
        },
      ],
      'es'
    );
    expect(text(await mount(hass))).toContain('Del 19 de diciembre al 3 de enero');
  });
});
