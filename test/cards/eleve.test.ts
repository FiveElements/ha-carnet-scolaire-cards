import { beforeAll, describe, expect, it } from 'vitest';
import { defineCard } from '../../src/core/registry';
import { SPEC } from '../../src/cards/eleve';
import { makeHass } from '../fixtures/hass';
import { mountCard, text } from '../fixtures/mount';
import type { MountableElement } from '../fixtures/mount';

declare global {
  interface HTMLElementTagNameMap {
    'carnet-scolaire-eleve': HTMLElement & MountableElement;
  }
}

beforeAll(() => {
  defineCard(SPEC);
});

const base = (
  attributes: Record<string, unknown> = {},
  state = '4e B',
  extra: Parameters<typeof makeHass>[0] = []
) =>
  makeHass([
    {
      key: 'sensor:class_name',
      entity_id: 'sensor.abc_classe',
      device: 'dev_enfant',
      state,
      attributes,
    },
    ...extra,
  ]);

describe('carte eleve', () => {
  it("affiche le nom de l'appareil et la classe", async () => {
    const el = await mountCard('carnet-scolaire-eleve', { device_id: 'dev_enfant' }, base());
    const t = text(el);
    expect(t).toContain('Enfant'); // nom de l'appareil dans la fixture
    expect(t).toContain('4e B');
  });

  it('donne le jour du prochain cours quand il n’a pas lieu aujourd’hui', async () => {
    // Un vendredi soir, « Maths à 08:30 » désignait le lundi.
    const el = await mountCard(
      'carnet-scolaire-eleve',
      { device_id: 'dev_enfant' },
      base({}, '4e B', [
        {
          key: 'sensor:next_lesson',
          entity_id: 'sensor.abc_prochain_cours',
          device: 'dev_enfant',
          state: '2099-01-05T08:30:00+01:00',
          attributes: { subject: 'Maths' },
        },
      ])
    );
    const t = text(el);
    expect(t).toContain('Maths');
    expect(t).toContain('08:30');
    expect(t).toContain('5 janvier');
  });

  it("n'affiche pas l'établissement par défaut", async () => {
    const el = await mountCard(
      'carnet-scolaire-eleve',
      { device_id: 'dev_enfant' },
      base({ establishment: 'Établissement synthétique' })
    );
    expect(text(el)).not.toContain('Établissement synthétique');
    // Assertion positive appariée : sans elle, ce test passerait aussi sur un rendu entièrement cassé.
    expect(text(el)).toContain('4e B');
  });

  it("affiche l'établissement uniquement si l'option est activée", async () => {
    const el = await mountCard(
      'carnet-scolaire-eleve',
      { device_id: 'dev_enfant', show_establishment: true },
      base({ establishment: 'Établissement synthétique' })
    );
    expect(text(el)).toContain('Établissement synthétique');
  });

  it('dit « pas encore collectée » quand l’entité est indisponible', async () => {
    const el = await mountCard(
      'carnet-scolaire-eleve',
      { device_id: 'dev_enfant' },
      base({}, 'unavailable')
    );
    expect(text(el)).toContain('pas encore collectée');
  });

  it("dit « introuvable » quand l'entité manque", async () => {
    const el = await mountCard('carnet-scolaire-eleve', { device_id: 'dev_enfant' }, makeHass([]));
    expect(text(el)).toContain('sensor:class_name');
  });

  it('affiche « En cours » et signale le prochain cours et la période', async () => {
    const el = await mountCard(
      'carnet-scolaire-eleve',
      { device_id: 'dev_enfant' },
      base({}, '4e B', [
        {
          key: 'binary_sensor:in_class',
          entity_id: 'binary_sensor.abc_en_cours',
          device: 'dev_enfant',
          state: 'on',
        },
        {
          key: 'sensor:next_lesson',
          entity_id: 'sensor.abc_prochain_cours',
          device: 'dev_enfant',
          state: '2026-09-09T14:00:00+02:00',
          attributes: { subject: 'Histoire' },
        },
        {
          key: 'sensor:current_period',
          entity_id: 'sensor.abc_periode',
          device: 'dev_enfant',
          state: 'Trimestre 1',
        },
      ])
    );
    const t = text(el);
    expect(t).toContain('En cours');
    expect(t).toContain('Histoire');
    expect(t).toContain('Trimestre 1');
  });

  it('affiche « Vacances » quand le capteur binaire correspondant est actif', async () => {
    const el = await mountCard(
      'carnet-scolaire-eleve',
      { device_id: 'dev_enfant' },
      base({}, '4e B', [
        {
          key: 'binary_sensor:holidays',
          entity_id: 'binary_sensor.abc_vacances',
          device: 'dev_enfant',
          state: 'on',
        },
      ])
    );
    expect(text(el)).toContain('Vacances');
  });

  it("ne rend aucune pastille d'état quand les trois capteurs binaires sont introuvables (palier désactivé)", async () => {
    // Sans binary_sensor:holidays / in_class / school_day résolus (tous
    // `optional`, un mercredi matin par exemple), la carte ne doit pas
    // affirmer « Pas de cours aujourd'hui » : elle tait ce qu'elle ignore.
    const el = await mountCard('carnet-scolaire-eleve', { device_id: 'dev_enfant' }, base());
    expect(el.shadowRoot?.querySelector('.chip')).toBeNull();
    // Assertion positive appariée : sans elle, ce test passerait aussi sur un rendu entièrement cassé.
    expect(text(el)).toContain('4e B');
  });

  it("rend la pastille d'état dès qu'un seul des trois capteurs binaires est résolu", async () => {
    const el = await mountCard(
      'carnet-scolaire-eleve',
      { device_id: 'dev_enfant' },
      base({}, '4e B', [
        {
          key: 'binary_sensor:school_day',
          entity_id: 'binary_sensor.abc_jour_de_classe',
          device: 'dev_enfant',
          state: 'on',
        },
      ])
    );
    expect(el.shadowRoot?.querySelector('.chip')).not.toBeNull();
    expect(text(el)).toContain('Jour de classe');
  });

  it("n'affiche aucune photo par défaut, même si l'entité image est disponible", async () => {
    const el = await mountCard(
      'carnet-scolaire-eleve',
      { device_id: 'dev_enfant' },
      base({}, '4e B', [
        {
          key: 'image:photo',
          entity_id: 'image.abc_photo',
          device: 'dev_enfant',
          state: '2026-09-08T07:00:00+00:00',
          attributes: { entity_picture: '/api/image_proxy/image.abc_photo' },
        },
      ])
    );
    expect(el.shadowRoot?.querySelector('img.photo')).toBeNull();
    // Assertion positive appariée : sans elle, ce test passerait aussi sur un rendu entièrement cassé.
    expect(text(el)).toContain('Enfant');
  });

  it("affiche l'entity_picture de l'entité image uniquement si show_photo est activé", async () => {
    const el = await mountCard(
      'carnet-scolaire-eleve',
      { device_id: 'dev_enfant', show_photo: true },
      base({}, '4e B', [
        {
          key: 'image:photo',
          entity_id: 'image.abc_photo',
          device: 'dev_enfant',
          state: '2026-09-08T07:00:00+00:00',
          attributes: { entity_picture: '/api/image_proxy/image.abc_photo' },
        },
      ])
    );
    const img = el.shadowRoot?.querySelector('img.photo');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe('/api/image_proxy/image.abc_photo');
  });

  // `stub` est la config que Home Assistant propose au parent qui ajoute la
  // carte depuis le sélecteur : elle ne doit jamais publier la photo par
  // défaut, sans quoi tout parent qui accepte la carte proposée publie la
  // photo de son enfant sans l'avoir demandé.
  it('ne propose pas show_photo dans la config par défaut du sélecteur (SPEC.stub)', () => {
    expect(SPEC.stub?.show_photo).toBeFalsy();
  });

  it("n'affiche aucune photo en partant de la config par défaut telle que Home Assistant la consomme (getStubConfig)", async () => {
    // La forme du constructeur est extraite dans un alias exprès : l'assertion
    // tient ainsi sur une seule ligne courte, que le formateur n'a aucune
    // raison de replier. Une suppression `next-line` ne couvre que la ligne
    // suivante — un repli la décale et la rend muette, ce qui est déjà arrivé.
    type CardConstructor = { getStubConfig(): Record<string, unknown> };
    const ctor = customElements.get('carnet-scolaire-eleve');
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- getStubConfig est un statique propre aux cartes Carnet scolaire, absent de l'interface DOM générique CustomElementConstructor ; la suppression est posée sous une forme que le formateur ne peut pas décaler.
    const stubConfig = (ctor as unknown as CardConstructor).getStubConfig();
    const el = await mountCard(
      'carnet-scolaire-eleve',
      // Comme le ferait Home Assistant : la config du sélecteur, seulement
      // complétée du device_id que l'éditeur pose ensuite — jamais une
      // config écrite à la main par le test.
      { ...stubConfig, device_id: 'dev_enfant' },
      base({}, '4e B', [
        {
          key: 'image:photo',
          entity_id: 'image.abc_photo',
          device: 'dev_enfant',
          state: '2026-09-08T07:00:00+00:00',
          attributes: { entity_picture: '/api/image_proxy/image.abc_photo' },
        },
      ])
    );
    expect(el.shadowRoot?.querySelector('img.photo')).toBeNull();
    // Assertion positive appariée : sans elle, ce test passerait aussi sur un rendu entièrement cassé.
    expect(text(el)).toContain('Enfant');
  });
});
