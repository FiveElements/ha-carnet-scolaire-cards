import { beforeAll, describe, expect, it } from 'vitest';
import { defineCard } from '../../src/core/registry';
import { SPEC } from '../../src/cards/evaluations';
import { makeHass } from '../fixtures/hass';
import { mountCard, text } from '../fixtures/mount';
import type { MountableElement } from '../fixtures/mount';

declare global {
  interface HTMLElementTagNameMap {
    'carnet-scolaire-evaluations': HTMLElement & MountableElement;
  }
}

beforeAll(() => {
  defineCard(SPEC);
});

// La forme reprend celle que l'intégration publie réellement — items[] avec
// name, subject, une date SEULE (`AAAA-MM-JJ`, `evaluation.date.isoformat()`
// sur un champ `date` côté intégration) et acquisitions[] portant name, level
// et abbreviation. L'ancienne fixture écrivait un horodatage avec décalage,
// que l'intégration ne publie pas : c'est ce qui a caché le recul d'un jour. Les VALEURS, elles, sont entièrement synthétiques : aucun nom
// d'élève, d'enseignant ou d'établissement ne doit entrer dans ce dépôt.
const items = [
  {
    name: 'Résolution de problèmes',
    subject: 'Mathématiques',
    date: '2026-09-02',
    acquisitions: [
      { name: 'Modéliser', level: 'Très bonne maîtrise', abbreviation: 'TBM' },
      { name: 'Calculer', level: 'Maîtrise fragile', abbreviation: 'MF' },
    ],
  },
  {
    name: 'Compréhension écrite',
    subject: 'Anglais',
    date: '2026-09-05',
    acquisitions: [{ name: 'Comprendre un texte', level: 'Maîtrise satisfaisante' }],
  },
];

const evals = (attributes: Record<string, unknown>, state = '2') =>
  makeHass([
    {
      key: 'sensor:evaluations',
      entity_id: 'sensor.abc_evaluations',
      device: 'dev_enfant',
      state,
      attributes,
    },
  ]);

describe('carte évaluations', () => {
  it('liste les évaluations, la plus récente en tête', async () => {
    const el = await mountCard(
      'carnet-scolaire-evaluations',
      { device_id: 'dev_enfant' },
      evals({ items })
    );
    const t = text(el);
    expect(t).toContain('Mathématiques');
    expect(t).toContain('Anglais');
    // La plus récente d'abord : Anglais (le 5) avant Mathématiques (le 2).
    expect(t.indexOf('Anglais')).toBeLessThan(t.indexOf('Mathématiques'));
  });

  it('date une évaluation au jour écrit, même dans un fuseau à décalage négatif', async () => {
    const hass = evals({ items });
    hass.config = { time_zone: 'America/Martinique' };
    const el = await mountCard('carnet-scolaire-evaluations', { device_id: 'dev_enfant' }, hass);
    const t = text(el);
    expect(t).toContain('samedi 5 septembre');
    expect(t).not.toContain('vendredi 4 septembre');
  });

  it('range une évaluation sans date en dernier, et la limite l’écarte en premier', async () => {
    const el = await mountCard(
      'carnet-scolaire-evaluations',
      { device_id: 'dev_enfant', limit: 2 },
      evals({ items: [...items, { name: 'Sans date', subject: 'Musique' }] })
    );
    const t = text(el);
    expect(t).toContain('Anglais');
    expect(t).toContain('Mathématiques');
    expect(t).not.toContain('Musique');
  });

  it('détaille les compétences et leur niveau, sans jamais les traduire', async () => {
    const el = await mountCard(
      'carnet-scolaire-evaluations',
      { device_id: 'dev_enfant' },
      evals({ items })
    );
    const t = text(el);
    expect(t).toContain('Modéliser');
    // Le libellé de maîtrise est le texte du serveur, rendu tel quel :
    // le traduire inventerait une échelle qui n'est pas celle de
    // l'établissement.
    expect(t).toContain('Très bonne maîtrise');
    expect(t).toContain('Maîtrise fragile');
  });

  it('retombe sur l’abréviation quand le niveau complet manque', async () => {
    const el = await mountCard(
      'carnet-scolaire-evaluations',
      { device_id: 'dev_enfant' },
      evals({
        items: [
          {
            subject: 'Histoire',
            date: '2026-09-04',
            acquisitions: [{ name: 'Se repérer', abbreviation: 'MS' }],
          },
        ],
      })
    );
    const t = text(el);
    expect(t).toContain('Se repérer');
    expect(t).toContain('MS');
  });

  it('masque le détail des compétences quand l’option est désactivée', async () => {
    const el = await mountCard(
      'carnet-scolaire-evaluations',
      { device_id: 'dev_enfant', show_acquisitions: false },
      evals({ items })
    );
    const t = text(el);
    expect(t).not.toContain('Modéliser');
    // Assertion positive : c'est le détail qui tombe, pas la liste.
    expect(t).toContain('Mathématiques');
  });

  it('dit « aucune évaluation » sur une liste vide, sans parler de panne', async () => {
    // C'est le cas de la rentrée : la collecte fonctionne, il n'y a
    // simplement rien à montrer. Distinct de « pas encore collectée ».
    const el = await mountCard(
      'carnet-scolaire-evaluations',
      { device_id: 'dev_enfant' },
      evals({ items: [] }, '0')
    );
    const t = text(el);
    expect(t).toContain('Aucune évaluation');
    expect(t).not.toContain('pas encore collectée');
  });

  it('ne disparaît pas quand `items` n’est pas un tableau', async () => {
    const el = await mountCard(
      'carnet-scolaire-evaluations',
      { device_id: 'dev_enfant' },
      evals({ items: { a: 1 } })
    );
    expect(text(el)).toContain('Aucune évaluation');
  });

  it('survit à une compétence nulle et à une évaluation sans date', async () => {
    const el = await mountCard(
      'carnet-scolaire-evaluations',
      { device_id: 'dev_enfant' },
      evals({
        items: [
          { subject: 'Physique', acquisitions: [null, { name: 'Observer', level: 'Acquis' }] },
        ],
      })
    );
    const t = text(el);
    expect(t).toContain('Physique');
    expect(t).toContain('Observer');
  });

  it('dit « pas encore collectée » quand l’entité est au registre sans état', async () => {
    const hass = makeHass([
      {
        key: 'sensor:evaluations',
        entity_id: 'sensor.abc_evaluations',
        device: 'dev_enfant',
        state: '0',
        unloaded: true,
      },
    ]);
    const el = await mountCard('carnet-scolaire-evaluations', { device_id: 'dev_enfant' }, hass);
    expect(text(el)).toContain('pas encore collectée');
  });

  it('dit « introuvable » quand l’entité est absente de l’appareil', async () => {
    const el = await mountCard('carnet-scolaire-evaluations', { device_id: 'dev_enfant' }, makeHass([]));
    expect(text(el)).toContain('sensor:evaluations');
  });

  it('annonce une hauteur moindre quand le détail des compétences est masqué', () => {
    const size = SPEC.size;
    expect(typeof size).toBe('function');
    if (typeof size !== 'function') return;
    expect(size({ type: 'x', show_acquisitions: false })).toBeLessThan(size({ type: 'x' }));
  });
});
