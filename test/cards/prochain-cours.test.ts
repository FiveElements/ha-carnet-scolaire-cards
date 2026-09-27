import { beforeAll, describe, expect, it } from 'vitest';
import { defineCard } from '../../src/core/registry';
import { SPEC } from '../../src/cards/prochain-cours';
import { makeHass } from '../fixtures/hass';
import { mountCard, text } from '../fixtures/mount';

declare global {
  interface HTMLElementTagNameMap {
    'carnet-scolaire-prochain-cours': HTMLElement & {
      setConfig(c: unknown): void;
      hass: unknown;
      readonly updateComplete: Promise<unknown>;
    };
  }
}

beforeAll(() => {
  defineCard(SPEC);
});

const lesson = (state: string, attributes: Record<string, unknown> = {}) =>
  makeHass([
    {
      key: 'sensor:next_lesson',
      entity_id: 'sensor.abc_prochain_cours',
      device: 'dev_enfant',
      state,
      attributes,
    },
  ]);

describe('carte prochain-cours', () => {
  it('affiche matière, heure, salle et professeur', async () => {
    const hass = lesson('2026-09-08T08:30:00+02:00', {
      subject: 'Mathématiques',
      classroom: 'B204',
      teachers: ['M. Dupont'],
      canceled: false,
    });
    const el = await mountCard('carnet-scolaire-prochain-cours', { device_id: 'dev_enfant' }, hass);
    const t = text(el);
    expect(t).toContain('Mathématiques');
    expect(t).toContain('08:30');
    expect(t).toContain('B204');
    expect(t).toContain('M. Dupont');
  });

  it('accepte teachers en chaîne comme en tableau', async () => {
    const hass = lesson('2026-09-08T08:30:00+02:00', {
      subject: 'Histoire',
      teachers: 'Mme Martin',
    });
    const el = await mountCard('carnet-scolaire-prochain-cours', { device_id: 'dev_enfant' }, hass);
    expect(text(el)).toContain('Mme Martin');
  });

  it('signale un cours annulé sans le masquer', async () => {
    const hass = lesson('2026-09-08T08:30:00+02:00', { subject: 'Anglais', canceled: true });
    const el = await mountCard('carnet-scolaire-prochain-cours', { device_id: 'dev_enfant' }, hass);
    const t = text(el);
    expect(t).toContain('Anglais');
    expect(t).toContain('annulé');
  });

  it('dit « aucun cours à venir » quand l’entité ne porte pas d’horodatage exploitable', async () => {
    // L'intégration expose 'none' — distinct de 'unknown'/'unavailable', qui
    // restent du ressort du socle — quand il n'y a plus de cours à venir.
    const el = await mountCard(
      'carnet-scolaire-prochain-cours',
      { device_id: 'dev_enfant' },
      lesson('none')
    );
    expect(text(el)).toContain('Aucun cours à venir');
  });

  it('dit « aucun cours à venir » sur la forme réelle : unknown avec fetched_at', async () => {
    // Quand plus aucun cours n'est collecté, `_next_lesson_start` rend None et
    // Home Assistant publie `unknown` (capteur TIMESTAMP) — la collecte a
    // pourtant réussi, `fetched_at` le prouve. Le socle écartait la carte et
    // disait « pas encore collectée » pendant toutes les vacances.
    const el = await mountCard(
      'carnet-scolaire-prochain-cours',
      { device_id: 'dev_enfant' },
      lesson('unknown', { fetched_at: '2026-10-17T18:00:00+02:00', stale: false })
    );
    const t = text(el);
    expect(t).toContain('Aucun cours à venir');
    expect(t).not.toContain('pas encore collectée');
  });

  it.each(['unknown', 'unavailable'])(
    'dit « pas encore collectée » sur %s sans aucun attribut',
    async (state) => {
      const el = await mountCard(
        'carnet-scolaire-prochain-cours',
        { device_id: 'dev_enfant' },
        lesson(state)
      );
      const t = text(el);
      expect(t).toContain('pas encore collectée');
      expect(t).not.toContain('Aucun cours à venir');
    }
  );

  it('affiche la matière malgré un état non parsable, sans effacer les attributs', async () => {
    // `parseTimestamp` rend `undefined` pour toute chaîne que `new Date()`
    // refuse, pas seulement pour 'none' : un format local ou un libellé de
    // l'intégration ne doit pas effacer matière/salle/professeur.
    const hass = lesson('Lundi 8h30', {
      subject: 'Mathématiques',
      classroom: 'B204',
      teachers: ['M. Dupont'],
    });
    const el = await mountCard('carnet-scolaire-prochain-cours', { device_id: 'dev_enfant' }, hass);
    const t = text(el);
    expect(t).toContain('Mathématiques');
    expect(t).toContain('B204');
    expect(t).toContain('M. Dupont');
    expect(t).not.toContain('Aucun cours à venir');
  });

  it('affiche la plage horaire de début et de fin quand `end` est présent', async () => {
    const hass = lesson('2026-09-08T08:30:00+02:00', {
      subject: 'Mathématiques',
      end: '2026-09-08T09:25:00+02:00',
    });
    const el = await mountCard('carnet-scolaire-prochain-cours', { device_id: 'dev_enfant' }, hass);
    const t = text(el);
    expect(t).toContain('08:30');
    expect(t).toContain('09:25');
  });

  it('dit « pas encore collectée » quand l’entité est indisponible', async () => {
    const el = await mountCard(
      'carnet-scolaire-prochain-cours',
      { device_id: 'dev_enfant' },
      lesson('unavailable')
    );
    expect(text(el)).toContain('pas encore collectée');
  });

  it("dit « introuvable » et nomme la clé quand l'entité manque", async () => {
    const el = await mountCard(
      'carnet-scolaire-prochain-cours',
      { device_id: 'dev_enfant' },
      makeHass([])
    );
    const t = text(el);
    expect(t).toContain('sensor:next_lesson');
    expect(t).toContain('introuvable');
  });

  it('affiche le réveil et la fin des cours quand les options sont activées', async () => {
    const hass = makeHass([
      {
        key: 'sensor:next_lesson',
        entity_id: 'sensor.abc_prochain_cours',
        device: 'dev_enfant',
        state: '2026-09-08T08:30:00+02:00',
        attributes: { subject: 'SVT' },
      },
      {
        key: 'sensor:next_wake_up',
        entity_id: 'sensor.abc_reveil',
        device: 'dev_enfant',
        state: '2026-09-08T07:00:00+02:00',
      },
      {
        key: 'sensor:end_of_lessons',
        entity_id: 'sensor.abc_fin_cours',
        device: 'dev_enfant',
        state: '2026-09-08T17:00:00+02:00',
      },
    ]);
    const el = await mountCard(
      'carnet-scolaire-prochain-cours',
      { device_id: 'dev_enfant', show_wake_up: true, show_end_of_day: true },
      hass
    );
    const t = text(el);
    expect(t).toContain('07:00');
    expect(t).toContain('17:00');
  });

  it("n'affiche aucune ligne de prochain contrôle quand l'option est absente", async () => {
    const hass = makeHass([
      {
        key: 'sensor:next_lesson',
        entity_id: 'sensor.abc_prochain_cours',
        device: 'dev_enfant',
        state: '2026-09-08T08:30:00+02:00',
        attributes: { subject: 'SVT' },
      },
      {
        key: 'sensor:next_test',
        entity_id: 'sensor.abc_prochain_controle',
        device: 'dev_enfant',
        state: '2026-09-15T09:00:00+02:00',
      },
    ]);
    const el = await mountCard('carnet-scolaire-prochain-cours', { device_id: 'dev_enfant' }, hass);
    expect(text(el)).not.toContain('Prochain contrôle');
    // Assertion positive appariée : sans elle, ce test passerait aussi sur un rendu entièrement cassé.
    expect(text(el)).toContain('SVT');
  });

  it("n'affiche aucune ligne de prochain contrôle quand l'option est active mais l'entité introuvable", async () => {
    const hass = makeHass([
      {
        key: 'sensor:next_lesson',
        entity_id: 'sensor.abc_prochain_cours',
        device: 'dev_enfant',
        state: '2026-09-08T08:30:00+02:00',
        attributes: { subject: 'SVT' },
      },
    ]);
    const el = await mountCard(
      'carnet-scolaire-prochain-cours',
      { device_id: 'dev_enfant', show_next_test: true },
      hass
    );
    const t = text(el);
    // L'entité optionnelle absente ne doit jamais produire un message
    // d'erreur : la ligne est simplement omise (spec « les trois états »).
    expect(t).not.toContain('Prochain contrôle');
    expect(t).not.toContain('introuvable');
    expect(t).toContain('SVT');
  });

  it('affiche le prochain contrôle avec son jour et son heure quand il est résolu', async () => {
    const hass = makeHass([
      {
        key: 'sensor:next_lesson',
        entity_id: 'sensor.abc_prochain_cours',
        device: 'dev_enfant',
        state: '2026-09-08T08:30:00+02:00',
        attributes: { subject: 'SVT' },
      },
      {
        key: 'sensor:next_test',
        entity_id: 'sensor.abc_prochain_controle',
        device: 'dev_enfant',
        state: '2026-09-15T09:00:00+02:00',
      },
    ]);
    const el = await mountCard(
      'carnet-scolaire-prochain-cours',
      { device_id: 'dev_enfant', show_next_test: true },
      hass
    );
    const t = text(el);
    expect(t).toContain('Prochain contrôle');
    expect(t).toContain('09:00');
    expect(t).toContain('mardi');
  });

  // L'heure de fin peut etre DEDUITE plutot que fournie : quand PRONOTE omet
  // la fin d'un cours, elle est calculee depuis la position du creneau dans
  // la grille, par un code dont le commentaire amont dit « might be wrong ».
  // La presenter comme une heure du serveur serait une affirmation que
  // personne ne peut tenir.
  it('marque une heure de fin deduite', async () => {
    const el = await mountCard(
      'carnet-scolaire-prochain-cours',
      { device_id: 'dev_enfant' },
      makeHass([
        {
          key: 'sensor:next_lesson',
          entity_id: 'sensor.abc_prochain_cours',
          device: 'dev_enfant',
          state: '2026-09-08T08:30:00+02:00',
          attributes: {
            subject: 'Mathematiques',
            end: '2026-09-08T09:30:00+02:00',
            end_inferred: true,
          },
        },
      ])
    );
    const t = text(el);
    expect(t).toContain('≈');
    expect(t).toContain('09:30');
    // L'explication est portee en infobulle, jamais laissee au seul symbole.
    const marque = el.shadowRoot?.querySelector('span[title]');
    expect(marque?.getAttribute('title')).toContain('déduite');
  });

  it('ne marque rien quand l’heure de fin vient du serveur', async () => {
    const el = await mountCard(
      'carnet-scolaire-prochain-cours',
      { device_id: 'dev_enfant' },
      makeHass([
        {
          key: 'sensor:next_lesson',
          entity_id: 'sensor.abc_prochain_cours',
          device: 'dev_enfant',
          state: '2026-09-08T08:30:00+02:00',
          attributes: {
            subject: 'Mathematiques',
            end: '2026-09-08T09:30:00+02:00',
            end_inferred: false,
          },
        },
      ])
    );
    const t = text(el);
    expect(t).not.toContain('≈');
    expect(t).toContain('09:30');
  });

  it("n'affiche aucune pastille « en cours » quand binary_sensor:in_class est absent", async () => {
    const el = await mountCard(
      'carnet-scolaire-prochain-cours',
      { device_id: 'dev_enfant' },
      lesson('2026-09-08T08:30:00+02:00', { subject: 'Mathématiques' })
    );
    const t = text(el);
    expect(t).not.toContain('Cours en ce moment');
    // Assertion positive : le rendu du cours suivant reste intact.
    expect(t).toContain('Mathématiques');
  });

  it("n'affiche aucune pastille « en cours » quand binary_sensor:in_class est à 'off'", async () => {
    const hass = makeHass([
      {
        key: 'sensor:next_lesson',
        entity_id: 'sensor.abc_prochain_cours',
        device: 'dev_enfant',
        state: '2026-09-08T08:30:00+02:00',
        attributes: { subject: 'Mathématiques' },
      },
      {
        key: 'binary_sensor:in_class',
        entity_id: 'binary_sensor.abc_en_cours',
        device: 'dev_enfant',
        state: 'off',
      },
    ]);
    const el = await mountCard('carnet-scolaire-prochain-cours', { device_id: 'dev_enfant' }, hass);
    const t = text(el);
    expect(t).not.toContain('Cours en ce moment');
    expect(t).toContain('Mathématiques');
  });

  it("affiche une pastille « en cours » à 'on', sans changer le cours affiché", async () => {
    const hass = makeHass([
      {
        key: 'sensor:next_lesson',
        entity_id: 'sensor.abc_prochain_cours',
        device: 'dev_enfant',
        state: '2026-09-08T08:30:00+02:00',
        attributes: { subject: 'Mathématiques' },
      },
      {
        key: 'binary_sensor:in_class',
        entity_id: 'binary_sensor.abc_en_cours',
        device: 'dev_enfant',
        state: 'on',
      },
    ]);
    const el = await mountCard('carnet-scolaire-prochain-cours', { device_id: 'dev_enfant' }, hass);
    const t = text(el);
    expect(t).toContain('Cours en ce moment');
    // Le cours affiché reste celui d'après : la pastille ajoute un repère,
    // elle ne se substitue jamais au contenu de la carte.
    expect(t).toContain('Mathématiques');
    // Et un intitulé sépare les deux. Sans lui, la pastille surplombe la
    // ligne du cours SUIVANT et on lit « Cours en ce moment / Mathématiques »
    // comme si Mathématiques était le cours en train de se dérouler —
    // constaté sur une instance réelle.
    const titres = Array.from(el.shadowRoot?.querySelectorAll('.title') ?? []).map(
      (n) => n.textContent
    );
    expect(titres).toContain('Prochain cours');
  });

  it('ne pose pas d’intitulé « Prochain cours » quand aucun cours n’est en train de se dérouler', async () => {
    // Sans pastille, il n'y a aucune ambiguïté à lever : l'intitulé ne serait
    // qu'une redite du nom de la carte.
    const el = await mountCard(
      'carnet-scolaire-prochain-cours',
      { device_id: 'dev_enfant' },
      makeHass([
        {
          key: 'sensor:next_lesson',
          entity_id: 'sensor.abc_prochain_cours',
          device: 'dev_enfant',
          state: '2026-09-08T08:30:00+02:00',
          attributes: { subject: 'Mathématiques' },
        },
      ])
    );
    const titres = Array.from(el.shadowRoot?.querySelectorAll('.title') ?? []).map(
      (n) => n.textContent
    );
    expect(titres).not.toContain('Prochain cours');
    expect(text(el)).toContain('Mathématiques');
  });

  it("n'affiche aucune notice de journée quand binary_sensor:lessons_canceled est absent", async () => {
    const el = await mountCard(
      'carnet-scolaire-prochain-cours',
      { device_id: 'dev_enfant' },
      lesson('2026-09-08T08:30:00+02:00', { subject: 'Anglais' })
    );
    const t = text(el);
    expect(t).not.toContain('Des cours sont annulés aujourd’hui');
    expect(t).toContain('Anglais');
  });

  it("n'affiche aucune notice de journée quand binary_sensor:lessons_canceled est à 'off'", async () => {
    const hass = makeHass([
      {
        key: 'sensor:next_lesson',
        entity_id: 'sensor.abc_prochain_cours',
        device: 'dev_enfant',
        state: '2026-09-08T08:30:00+02:00',
        attributes: { subject: 'Anglais' },
      },
      {
        key: 'binary_sensor:lessons_canceled',
        entity_id: 'binary_sensor.abc_cours_annules',
        device: 'dev_enfant',
        state: 'off',
      },
    ]);
    const el = await mountCard('carnet-scolaire-prochain-cours', { device_id: 'dev_enfant' }, hass);
    const t = text(el);
    expect(t).not.toContain('Des cours sont annulés aujourd’hui');
    expect(t).toContain('Anglais');
  });

  it("affiche une notice de journée quand binary_sensor:lessons_canceled est à 'on'", async () => {
    const hass = makeHass([
      {
        key: 'sensor:next_lesson',
        entity_id: 'sensor.abc_prochain_cours',
        device: 'dev_enfant',
        state: '2026-09-08T08:30:00+02:00',
        attributes: { subject: 'Anglais' },
      },
      {
        key: 'binary_sensor:lessons_canceled',
        entity_id: 'binary_sensor.abc_cours_annules',
        device: 'dev_enfant',
        state: 'on',
      },
    ]);
    const el = await mountCard('carnet-scolaire-prochain-cours', { device_id: 'dev_enfant' }, hass);
    const t = text(el);
    expect(t).toContain('Des cours sont annulés aujourd’hui');
    expect(t).toContain('Anglais');
  });

  it(
    'la notice de journée ne marque jamais le cours affiché comme annulé (pas de doublon avec ' +
      "l'attribut `canceled` du prochain cours)",
    async () => {
      const hass = makeHass([
        {
          key: 'sensor:next_lesson',
          entity_id: 'sensor.abc_prochain_cours',
          device: 'dev_enfant',
          state: '2026-09-08T08:30:00+02:00',
          attributes: { subject: 'Anglais', canceled: false },
        },
        {
          key: 'binary_sensor:lessons_canceled',
          entity_id: 'binary_sensor.abc_cours_annules',
          device: 'dev_enfant',
          state: 'on',
        },
      ]);
      const el = await mountCard('carnet-scolaire-prochain-cours', { device_id: 'dev_enfant' }, hass);
      const t = text(el);
      // La notice de journée apparaît bien...
      expect(t).toContain('Des cours sont annulés aujourd’hui');
      // ... mais le cours affiché, lui, n'est ni barré ni marqué annulé :
      // seul l'attribut `canceled` du prochain cours peut poser ces marques,
      // et il vaut `false` ici.
      expect(el.shadowRoot?.querySelector('.row.canceled')).toBeNull();
      expect(el.shadowRoot?.querySelector('.chip.problem')).toBeNull();
      expect(t).toContain('Anglais');
    }
  );
});
