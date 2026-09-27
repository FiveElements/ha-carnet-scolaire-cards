import { beforeAll, describe, expect, it } from 'vitest';
import { defineCard } from '../../src/core/registry';
import { SPEC } from '../../src/cards/vie-scolaire';
import { makeHass } from '../fixtures/hass';
import { mountCard, text } from '../fixtures/mount';
import type { MountableElement } from '../fixtures/mount';

declare global {
  interface HTMLElementTagNameMap {
    'carnet-scolaire-vie-scolaire': HTMLElement & MountableElement;
  }
}

beforeAll(() => {
  defineCard(SPEC);
});

// Les formes RÉELLES (`_absence_dict`, `_delay_dict` côté intégration) :
// `from_date`, `to_date` et `date` sont des horodatages complets, et `hours`
// est la CHAÎNE que PRONOTE écrit (« 2h00 »), jamais un nombre. Les anciennes
// fixtures écrivaient des dates seules et `hours: 2`, et laissaient donc sans
// test la branche que les vraies données traversent.
const full = () =>
  makeHass([
    {
      key: 'sensor:absences',
      entity_id: 'sensor.abc_absences',
      device: 'dev_enfant',
      state: '1',
      attributes: {
        items: [{ from_date: '2026-09-01T08:00:00+02:00', to_date: '2026-09-01T10:00:00+02:00', hours: '2h00', justified: false }],
      },
    },
    {
      key: 'sensor:delays',
      entity_id: 'sensor.abc_retards',
      device: 'dev_enfant',
      state: '1',
      attributes: { items: [{ date: '2026-09-02T08:10:00+02:00', minutes: 10, justified: true }] },
    },
    {
      key: 'sensor:punishments',
      entity_id: 'sensor.abc_punitions',
      device: 'dev_enfant',
      state: '1',
      attributes: {
        items: [
          {
            nature: 'Retenue',
            giver: 'M. Dupont',
            schedule: [{ start: '2026-09-08T17:00:00+02:00', duration_minutes: 60 }],
          },
        ],
      },
    },
  ]);

describe('carte vie-scolaire', () => {
  it('affiche absences, retards et punitions', async () => {
    const el = await mountCard('carnet-scolaire-vie-scolaire', { device_id: 'dev_enfant' }, full());
    const t = text(el);
    expect(t).toContain('Absences');
    expect(t).toContain('non justifiée');
    expect(t).toContain('Retards');
    expect(t).toContain('Punitions');
    expect(t).toContain('Retenue');
  });

  it('signale une absence en cours', async () => {
    const hass = full();
    hass.entities['binary_sensor.abc_absence_en_cours'] = {
      entity_id: 'binary_sensor.abc_absence_en_cours',
      device_id: 'dev_enfant',
      labels: [],
      platform: 'carnet_scolaire',
      translation_key: 'absence_in_progress',
    };
    hass.states['binary_sensor.abc_absence_en_cours'] = {
      entity_id: 'binary_sensor.abc_absence_en_cours',
      state: 'on',
      attributes: {},
      last_changed: '2026-09-08T07:00:00+00:00',
      last_updated: '2026-09-08T07:00:00+00:00',
    };
    const el = await mountCard('carnet-scolaire-vie-scolaire', { device_id: 'dev_enfant' }, hass);
    expect(text(el)).toContain('Absence en cours');
  });

  it('respecte limit', async () => {
    const hass = makeHass([
      {
        key: 'sensor:absences',
        entity_id: 'sensor.abc_absences',
        device: 'dev_enfant',
        state: '2',
        attributes: {
          items: [
            { from_date: '2026-09-01T08:00:00+02:00', to_date: '2026-09-01T10:00:00+02:00', hours: '2h00', justified: false },
            { from_date: '2026-09-05T08:00:00+02:00', to_date: '2026-09-05T09:00:00+02:00', hours: '1h00', justified: true },
          ],
        },
      },
    ]);
    const el = await mountCard(
      'carnet-scolaire-vie-scolaire',
      { device_id: 'dev_enfant', limit: 1 },
      hass
    );
    const t = text(el);
    expect(t).toContain('5 septembre');
    expect(t).not.toContain('1 septembre');
  });

  it('restreint aux blocs choisis via sections', async () => {
    const el = await mountCard(
      'carnet-scolaire-vie-scolaire',
      { device_id: 'dev_enfant', sections: ['punishments'] },
      full()
    );
    const t = text(el);
    expect(t).toContain('Punitions');
    expect(t).not.toContain('Absences');
    expect(t).not.toContain('Retards');
  });

  it('dit « rien à signaler » quand toutes les listes sont vides', async () => {
    const hass = makeHass([
      {
        key: 'sensor:absences',
        entity_id: 'sensor.abc_absences',
        device: 'dev_enfant',
        state: '0',
        attributes: { items: [] },
      },
    ]);
    const el = await mountCard('carnet-scolaire-vie-scolaire', { device_id: 'dev_enfant' }, hass);
    const t = text(el);
    expect(t).toContain('Rien à signaler');
    expect(t).not.toContain('pas encore collectée');
  });

  it('dit « pas encore collectée » quand tout est indisponible', async () => {
    const hass = makeHass([
      {
        key: 'sensor:absences',
        entity_id: 'sensor.abc_absences',
        device: 'dev_enfant',
        state: 'unavailable',
      },
    ]);
    const el = await mountCard('carnet-scolaire-vie-scolaire', { device_id: 'dev_enfant' }, hass);
    expect(text(el)).toContain('pas encore collectée');
  });

  it("dit « introuvable » quand aucune clé n'existe", async () => {
    const el = await mountCard(
      'carnet-scolaire-vie-scolaire',
      { device_id: 'dev_enfant' },
      makeHass([])
    );
    expect(text(el)).toContain('introuvable');
  });

  it('affiche le bandeau « absence en cours » ET le message de vide quand aucune ligne ne le confirme encore', async () => {
    // Cas exact du correctif : le début d'une absence n'est pas encore
    // consigné dans `items`, mais le binary_sensor est déjà à `on`. Le
    // bandeau et le message de vide doivent coexister — ni l'un n'écrase
    // l'autre.
    const hass = makeHass([
      {
        key: 'sensor:absences',
        entity_id: 'sensor.abc_absences',
        device: 'dev_enfant',
        state: '0',
        attributes: { items: [] },
      },
    ]);
    hass.entities['binary_sensor.abc_absence_en_cours'] = {
      entity_id: 'binary_sensor.abc_absence_en_cours',
      device_id: 'dev_enfant',
      labels: [],
      platform: 'carnet_scolaire',
      translation_key: 'absence_in_progress',
    };
    hass.states['binary_sensor.abc_absence_en_cours'] = {
      entity_id: 'binary_sensor.abc_absence_en_cours',
      state: 'on',
      attributes: {},
      last_changed: '2026-09-08T07:00:00+00:00',
      last_updated: '2026-09-08T07:00:00+00:00',
    };
    const el = await mountCard('carnet-scolaire-vie-scolaire', { device_id: 'dev_enfant' }, hass);
    const t = text(el);
    expect(t).toContain('Absence en cours');
    expect(t).toContain('Rien à signaler');
  });

  it('ne fait pas disparaître la carte quand `items` est un objet plutôt qu’un tableau', async () => {
    const hass = makeHass([
      {
        key: 'sensor:absences',
        entity_id: 'sensor.abc_absences',
        device: 'dev_enfant',
        state: '1',
        attributes: { items: { 0: 'inattendu' } },
      },
    ]);
    const el = await mountCard('carnet-scolaire-vie-scolaire', { device_id: 'dev_enfant' }, hass);
    expect(text(el)).toContain('Rien à signaler');
  });

  it('ne fait pas disparaître la carte quand `items` est une chaîne', async () => {
    const hass = makeHass([
      {
        key: 'sensor:delays',
        entity_id: 'sensor.abc_retards',
        device: 'dev_enfant',
        state: '1',
        attributes: { items: 'x' },
      },
    ]);
    const el = await mountCard('carnet-scolaire-vie-scolaire', { device_id: 'dev_enfant' }, hass);
    expect(text(el)).toContain('Rien à signaler');
  });

  it('écarte les trous du tableau `items` plutôt que de lever', async () => {
    const hass = makeHass([
      {
        key: 'sensor:punishments',
        entity_id: 'sensor.abc_punitions',
        device: 'dev_enfant',
        state: '1',
        attributes: { items: [null] },
      },
    ]);
    const el = await mountCard('carnet-scolaire-vie-scolaire', { device_id: 'dev_enfant' }, hass);
    expect(text(el)).toContain('Rien à signaler');
  });

  it('rend les absences et les retards du plus récent au plus ancien, quel que soit l’ordre reçu', async () => {
    const hass = makeHass([
      {
        key: 'sensor:absences',
        entity_id: 'sensor.abc_absences',
        device: 'dev_enfant',
        state: '3',
        attributes: {
          // Volontairement dans le désordre : ni trié, ni le plus récent
          // en tête — pour vérifier que la carte trie elle-même sur la
          // date avant de choisir l'ordre d'affichage.
          items: [
            { from_date: '2026-09-03T08:00:00+02:00', to_date: '2026-09-03T09:00:00+02:00', hours: '1h00', justified: true },
            { from_date: '2026-09-01T08:00:00+02:00', to_date: '2026-09-01T10:00:00+02:00', hours: '2h00', justified: false },
            { from_date: '2026-09-05T08:00:00+02:00', to_date: '2026-09-05T11:00:00+02:00', hours: '3h00', justified: true },
          ],
        },
      },
      {
        key: 'sensor:delays',
        entity_id: 'sensor.abc_retards',
        device: 'dev_enfant',
        state: '3',
        attributes: {
          items: [
            { date: '2026-09-02T08:10:00+02:00', minutes: 5, justified: true },
            { date: '2026-09-10T08:10:00+02:00', minutes: 15, justified: false },
            { date: '2026-09-06T08:10:00+02:00', minutes: 10, justified: true },
          ],
        },
      },
    ]);
    const el = await mountCard('carnet-scolaire-vie-scolaire', { device_id: 'dev_enfant' }, hass);
    const t = text(el);

    // Les dates sont mises en toutes lettres : c'est le libellé rendu qu'on
    // repère, plus jamais l'horodatage ISO brut.
    const posAbsence5 = t.indexOf('5 septembre');
    const posAbsence3 = t.indexOf('3 septembre');
    const posAbsence1 = t.indexOf('1 septembre');
    expect(posAbsence5).toBeGreaterThanOrEqual(0);
    expect(posAbsence3).toBeGreaterThan(posAbsence5);
    expect(posAbsence1).toBeGreaterThan(posAbsence3);

    const posDelay10 = t.indexOf('10 septembre');
    const posDelay06 = t.indexOf('6 septembre');
    const posDelay02 = t.indexOf('2 septembre');
    expect(posDelay10).toBeGreaterThanOrEqual(0);
    expect(posDelay06).toBeGreaterThan(posDelay10);
    expect(posDelay02).toBeGreaterThan(posDelay06);
  });

  it('traite `limit: 0` comme « aucun élément », pas comme « tous »', async () => {
    const hass = makeHass([
      {
        key: 'sensor:absences',
        entity_id: 'sensor.abc_absences',
        device: 'dev_enfant',
        state: '1',
        attributes: {
          items: [{ from_date: '2026-09-01T08:00:00+02:00', to_date: '2026-09-01T10:00:00+02:00', hours: '2h00', justified: false }],
        },
      },
    ]);
    const el = await mountCard(
      'carnet-scolaire-vie-scolaire',
      { device_id: 'dev_enfant', limit: 0 },
      hass
    );
    const t = text(el);
    expect(t).not.toContain('1 septembre');
    expect(t).toContain('Rien à signaler');
  });

  it('affiche son compteur quand `sensor:unjustified_absences` est le seul capteur résolu', async () => {
    // Cas exact du correctif : avant l'ajout à `requiresAny`, un parent dont
    // l'intégration ne publie que ce capteur voyait « entité introuvable »
    // alors que la donnée était bien là.
    const hass = makeHass([
      {
        key: 'sensor:unjustified_absences',
        entity_id: 'sensor.abc_absences_non_justifiees',
        device: 'dev_enfant',
        state: '2',
      },
    ]);
    const el = await mountCard('carnet-scolaire-vie-scolaire', { device_id: 'dev_enfant' }, hass);
    const t = text(el);
    expect(t).not.toContain('introuvable');
    expect(t).toContain('Absences non justifiées');
    expect(t).toContain('2');
  });

  it('signale une punition à venir sans échéance quand `sensor:next_punishment` est absent', async () => {
    const hass = full();
    hass.entities['binary_sensor.abc_punition_a_venir'] = {
      entity_id: 'binary_sensor.abc_punition_a_venir',
      device_id: 'dev_enfant',
      labels: [],
      platform: 'carnet_scolaire',
      translation_key: 'punishment_upcoming',
    };
    hass.states['binary_sensor.abc_punition_a_venir'] = {
      entity_id: 'binary_sensor.abc_punition_a_venir',
      state: 'on',
      attributes: {},
      last_changed: '2026-09-08T07:00:00+00:00',
      last_updated: '2026-09-08T07:00:00+00:00',
    };
    const el = await mountCard('carnet-scolaire-vie-scolaire', { device_id: 'dev_enfant' }, hass);
    const t = text(el);
    expect(t).toContain('Punition à venir');
    expect(t).not.toContain('Prochaine punition');
  });

  it('affiche l’échéance formatée quand `sensor:next_punishment` est résolu', async () => {
    const hass = full();
    hass.entities['binary_sensor.abc_punition_a_venir'] = {
      entity_id: 'binary_sensor.abc_punition_a_venir',
      device_id: 'dev_enfant',
      labels: [],
      platform: 'carnet_scolaire',
      translation_key: 'punishment_upcoming',
    };
    hass.states['binary_sensor.abc_punition_a_venir'] = {
      entity_id: 'binary_sensor.abc_punition_a_venir',
      state: 'on',
      attributes: {},
      last_changed: '2026-09-08T07:00:00+00:00',
      last_updated: '2026-09-08T07:00:00+00:00',
    };
    hass.entities['sensor.abc_prochaine_punition'] = {
      entity_id: 'sensor.abc_prochaine_punition',
      device_id: 'dev_enfant',
      labels: [],
      platform: 'carnet_scolaire',
      translation_key: 'next_punishment',
    };
    hass.states['sensor.abc_prochaine_punition'] = {
      entity_id: 'sensor.abc_prochaine_punition',
      state: '2026-09-15T14:00:00+00:00',
      attributes: {},
      last_changed: '2026-09-08T07:00:00+00:00',
      last_updated: '2026-09-08T07:00:00+00:00',
    };
    const el = await mountCard('carnet-scolaire-vie-scolaire', { device_id: 'dev_enfant' }, hass);
    const t = text(el);
    expect(t).toContain('Prochaine punition');
    expect(t).toContain('septembre');
    expect(t).not.toContain('2026-09-15T14:00:00+00:00');
  });

  it('accorde « justifié » au féminin pour une absence, au masculin pour un retard', async () => {
    const hass = makeHass([
      {
        key: 'sensor:absences',
        entity_id: 'sensor.abc_absences',
        device: 'dev_enfant',
        state: '1',
        attributes: {
          items: [{ from_date: '2026-09-01T08:00:00+02:00', to_date: '2026-09-01T10:00:00+02:00', hours: '2h00', justified: false }],
        },
      },
      {
        key: 'sensor:delays',
        entity_id: 'sensor.abc_retards',
        device: 'dev_enfant',
        state: '1',
        attributes: { items: [{ date: '2026-09-02T08:10:00+02:00', minutes: 10, justified: false }] },
      },
    ]);
    const el = await mountCard('carnet-scolaire-vie-scolaire', { device_id: 'dev_enfant' }, hass);
    const t = text(el);
    expect(t).toContain('non justifiée');
    expect(t).toContain('non justifié');
    // Comptage plutôt qu'inclusion de sous-chaîne : « non justifié » est un
    // préfixe de « non justifiée », une simple assertion `toContain` ne
    // distinguerait donc pas un accord correct d'un accord resté féminin
    // partout.
    const feminineCount = (t.match(/non justifiée/g) ?? []).length;
    const allCount = (t.match(/non justifié/g) ?? []).length;
    expect(feminineCount).toBe(1);
    expect(allCount - feminineCount).toBe(1);
  });

  it('demande au catalogue les libellés des options du sélecteur sections', () => {
    const paths: string[] = [];
    const monT = (path: string): string => {
      paths.push(path);
      return `[${path}]`;
    };
    const fields = SPEC.schema({ type: 'x' }, monT);
    const sections = fields.find((f) => f.name === 'sections');
    expect(paths).toContain('vie_scolaire.absences');
    expect(paths).toContain('vie_scolaire.delays');
    expect(paths).toContain('vie_scolaire.punishments');
    if (!sections) throw new Error('champ sections introuvable dans le schéma');
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- `HaFormSchema.selector` est typé `Record<string, unknown>` ; ce test connaît la forme précise posée juste au-dessus, dans ce même fichier.
    const selector = sections.selector as {
      select: { options: { value: string; label: string }[] };
    };
    expect(selector.select.options).toEqual([
      { value: 'absences', label: '[vie_scolaire.absences]' },
      { value: 'delays', label: '[vie_scolaire.delays]' },
      { value: 'punishments', label: '[vie_scolaire.punishments]' },
    ]);
  });

  // Les quatre cas ci-dessous viennent d'une instance réelle : la carte y
  // affichait des horodatages ISO bruts, un « NaN h NaN », et taisait la
  // durée d'une punition. La forme des attributs est celle que
  // l'intégration publie (`_absence_dict`, `_delay_dict`, `_punishment_dict`).
  it('met les bornes d’une absence en toutes lettres, jamais en ISO brut', async () => {
    const hass = makeHass([
      {
        key: 'sensor:absences',
        entity_id: 'sensor.abc_absences',
        device: 'dev_enfant',
        state: '1',
        attributes: {
          items: [
            {
              from_date: '2026-09-07T14:00:00+02:00',
              to_date: '2026-09-07T16:00:00+02:00',
              justified: true,
            },
          ],
        },
      },
    ]);
    const el = await mountCard('carnet-scolaire-vie-scolaire', { device_id: 'dev_enfant' }, hass);
    const t = text(el);
    expect(t).toContain('7 septembre');
    expect(t).toContain('14:00');
    expect(t).toContain('16:00');
    expect(t).not.toContain('2026-09-07T14:00:00+02:00');
  });

  it('rend la durée d’absence écrite par l’établissement telle quelle', async () => {
    // PRONOTE écrit « 2h00 » : une chaîne. La multiplier par 60 rendait
    // « NaN h NaN » — le défaut exact observé en production.
    const hass = makeHass([
      {
        key: 'sensor:absences',
        entity_id: 'sensor.abc_absences',
        device: 'dev_enfant',
        state: '1',
        attributes: {
          items: [
            {
              from_date: '2026-09-07T14:00:00+02:00',
              to_date: '2026-09-07T16:00:00+02:00',
              hours: '2h00',
              justified: true,
              reasons: ['MALADIE SANS CERTIFICAT'],
            },
          ],
        },
      },
    ]);
    const el = await mountCard('carnet-scolaire-vie-scolaire', { device_id: 'dev_enfant' }, hass);
    const t = text(el);
    expect(t).toContain('2h00');
    expect(t).not.toContain('NaN');
    // Le motif écrit par l'établissement, rendu tel quel.
    expect(t).toContain('MALADIE SANS CERTIFICAT');
  });

  it('détaille les absences non justifiées quand elles sont seules publiées, sans dire « Rien à signaler »', async () => {
    // Cas prévu par `requiresAny` : seul `sensor:unjustified_absences` existe.
    // Le détail n'était lu que sur `sensor:absences`, et la carte écrivait
    // « Rien à signaler » juste sous le compteur « 2 ».
    const hass = makeHass([
      {
        key: 'sensor:unjustified_absences',
        entity_id: 'sensor.abc_absences_non_justifiees',
        device: 'dev_enfant',
        state: '1',
        attributes: {
          items: [
            {
              from_date: '2026-09-01T08:00:00+02:00',
              to_date: '2026-09-01T10:00:00+02:00',
              hours: '2h00',
              justified: false,
            },
          ],
        },
      },
    ]);
    const el = await mountCard('carnet-scolaire-vie-scolaire', { device_id: 'dev_enfant' }, hass);
    const t = text(el);
    expect(t).toContain('2h00');
    expect(t).not.toContain('Rien à signaler');
  });

  it('dit « pas encore collectée », pas « Rien à signaler », quand la section voulue n’est pas collectée', async () => {
    const hass = makeHass([
      {
        key: 'sensor:delays',
        entity_id: 'sensor.abc_retards',
        device: 'dev_enfant',
        state: 'unknown',
        attributes: {},
      },
      {
        key: 'sensor:absences',
        entity_id: 'sensor.abc_absences',
        device: 'dev_enfant',
        state: '0',
        attributes: { items: [] },
      },
    ]);
    const el = await mountCard(
      'carnet-scolaire-vie-scolaire',
      { device_id: 'dev_enfant', sections: ['delays'] },
      hass
    );
    const t = text(el);
    expect(t).toContain('pas encore collectée');
    expect(t).not.toContain('Rien à signaler');
  });

  it('accepte encore un nombre d’heures, converti en durée', async () => {
    const hass = makeHass([
      {
        key: 'sensor:absences',
        entity_id: 'sensor.abc_absences',
        device: 'dev_enfant',
        state: '1',
        attributes: {
          items: [{ from_date: '2026-09-01T08:00:00+02:00', to_date: '2026-09-01T10:00:00+02:00', hours: 2, justified: false }],
        },
      },
    ]);
    const el = await mountCard('carnet-scolaire-vie-scolaire', { device_id: 'dev_enfant' }, hass);
    const t = text(el);
    expect(t).toContain('2 h');
    expect(t).not.toContain('NaN');
  });

  it('lit la durée d’une punition sur ses créneaux, où elle vit réellement', async () => {
    const hass = makeHass([
      {
        key: 'sensor:punishments',
        entity_id: 'sensor.abc_punitions',
        device: 'dev_enfant',
        state: '1',
        attributes: {
          items: [
            {
              nature: 'Retenue',
              giver: 'M. Dupont',
              schedule: [
                { start: '2026-09-08T17:00:00+02:00', duration_minutes: 60 },
                { start: '2026-09-09T17:00:00+02:00', duration_minutes: 30 },
              ],
            },
          ],
        },
      },
    ]);
    const el = await mountCard('carnet-scolaire-vie-scolaire', { device_id: 'dev_enfant' }, hass);
    const t = text(el);
    expect(t).toContain('Retenue');
    // La somme des deux créneaux : 90 minutes.
    expect(t).toContain('1 h 30');
  });
});
