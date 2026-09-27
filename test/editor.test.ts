import { describe, expect, it } from 'vitest';
import { html } from 'lit';
import { CarnetCardEditor } from '../src/core/editor';
import { localize } from '../src/localize';
import type { CardSpec, Translate } from '../src/core/types';
import { makeHass } from './fixtures/hass';
import { mountCard, text } from './fixtures/mount';

const SPEC: CardSpec = {
  type: 'carnet-scolaire-test-editor',
  name: 'Test',
  description: 'Carte de test',
  key: 'notes',
  scope: 'child',
  requires: () => ['sensor:next_lesson'],
  optional: () => ['sensor:menu_today'],
  schema: () => [],
  render: () => html``,
};

/**
 * Ré-expose computeLabel/computeHelper (protégés) pour les tests, plutôt que
 * de les lire depuis l'extérieur par une conversion de type qui contourne
 * TypeScript.
 */
class TestEditor extends CarnetCardEditor {
  labelFor(name: string): string {
    return this.computeLabel({ name, selector: {} });
  }
  helperFor(name: string): string | undefined {
    return this.computeHelper({ name, selector: {} });
  }
}

if (!customElements.get('carnet-scolaire-card-editor-test')) {
  customElements.define('carnet-scolaire-card-editor-test', TestEditor);
}

declare global {
  interface HTMLElementTagNameMap {
    'carnet-scolaire-card-editor-test': TestEditor;
  }
}

const mount = (config: Record<string, unknown>, hass: unknown) =>
  mountCard('carnet-scolaire-card-editor-test', config, hass, { spec: SPEC });

describe('CarnetCardEditor — diagnostic de résolution', () => {
  it('signale les clés trouvées et les clés introuvables', async () => {
    const hass = makeHass([
      { key: 'sensor:next_lesson', entity_id: 'sensor.abc_pc', device: 'dev_enfant' },
    ]);
    const el = await mount({ device_id: 'dev_enfant' }, hass);
    expect(text(el)).toContain('sensor:next_lesson');
    expect(text(el)).toContain('sensor:menu_today');
    expect(text(el)).toContain('trouvée');
    expect(text(el)).toContain('introuvable');
  });

  it('ne dit pas « trouvée » pour une surcharge qui ne désigne rien', async () => {
    const el = await mount(
      { device_id: 'dev_enfant', entities: { 'sensor:next_lesson': 'sensor.abc_prochain_cour' } },
      makeHass([])
    );
    const t = text(el);
    expect(t).toContain('sensor:next_lesson');
    expect(t).toContain('introuvable');
    expect(t).not.toMatch(/(^|[^n])trouvée/);
  });

  it("avertit quand l'utilisateur choisit l'appareil de compte", async () => {
    const el = await mount({ device_id: 'dev_compte' }, makeHass([]));
    expect(text(el)).toContain('est un compte, pas un enfant');
  });

  it("dit que l'appareil n'existe plus plutôt que d'accuser à tort un appareil de compte", async () => {
    const el = await mount({ device_id: 'dev_disparu' }, makeHass([]));
    expect(text(el)).toContain("n'existe plus");
    expect(text(el)).not.toContain('est un compte, pas un enfant');
  });

  it("n'affiche pas de diagnostic sans appareil choisi", async () => {
    const el = await mount({}, makeHass([]));
    expect(text(el)).not.toContain(localize('editor.diagnosis'));
  });

  it('émet config-changed quand ha-form remonte une valeur', async () => {
    const el = await mount({ device_id: 'dev_enfant' }, makeHass([]));
    let received: unknown;
    el.addEventListener('config-changed', (e) => {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- addEventListener ne type l'évènement qu'en Event ; `config-changed` est un CustomEvent, comme tout évènement personnalisé du DOM.
      received = (e as CustomEvent).detail.config;
    });
    el.shadowRoot?.querySelector('ha-form')?.dispatchEvent(
      new CustomEvent('value-changed', {
        detail: { value: { device_id: 'dev_enfant', title: 'École' } },
      })
    );
    expect(received).toMatchObject({ title: 'École' });
  });

  it('remplace la config plutôt que la fusionner — un champ vidé doit rester vide', async () => {
    const el = await mount({ device_id: 'dev_enfant', title: 'École' }, makeHass([]));
    let received: unknown;
    el.addEventListener('config-changed', (e) => {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- addEventListener ne type l'évènement qu'en Event ; `config-changed` est un CustomEvent, comme tout évènement personnalisé du DOM.
      received = (e as CustomEvent).detail.config;
    });
    // ha-form remonte l'objet complet, sans la clé « title » : l'utilisateur l'a vidée.
    el.shadowRoot?.querySelector('ha-form')?.dispatchEvent(
      new CustomEvent('value-changed', {
        detail: { value: { device_id: 'dev_enfant' } },
      })
    );
    expect(received).not.toHaveProperty('title');
  });

  it('résout le libellé d’un champ propre à la carte via sa racine de catalogue, et retombe sur editor. pour un champ de base', async () => {
    const el = await mount({ device_id: 'dev_enfant' }, makeHass([]));
    expect(el.labelFor('sections')).toBe(localize('notes.sections'));
    expect(el.labelFor('title')).toBe(localize('editor.title'));
  });

  it("résout l'aide d'un champ (device_id) et rend undefined quand aucune aide n'existe", async () => {
    const el = await mount({ device_id: 'dev_enfant' }, makeHass([]));
    expect(el.helperFor('device_id')).toBe(localize('editor.device_id_helper'));
    expect(el.helperFor('title')).toBeUndefined();
  });

  it('retombe sur le nom du champ, jamais sur le chemin de traduction, quand aucun libellé n’existe — même repli que computeHelper', async () => {
    const el = await mount({ device_id: 'dev_enfant' }, makeHass([]));
    expect(el.labelFor('un_champ_sans_traduction')).toBe('un_champ_sans_traduction');
  });

  it('passe la fonction de traduction à spec.schema, pour que la carte évite les libellés en dur', async () => {
    let received: Translate | undefined;
    const SPEC_T: CardSpec = {
      ...SPEC,
      type: 'carnet-scolaire-test-editor-t',
      schema: (_config, t) => {
        received = t;
        return [];
      },
    };
    await mountCard('carnet-scolaire-card-editor-test', { device_id: 'dev_enfant' }, makeHass([]), {
      spec: SPEC_T,
    });
    expect(received).toBeTypeOf('function');
    expect(received?.('common.refresh')).toBe(localize('common.refresh'));
  });

  it("schema(config, t) reçoit t optionnel : une carte non migrée qui l'ignore continue de fonctionner", async () => {
    const SPEC_NO_T: CardSpec = {
      ...SPEC,
      type: 'carnet-scolaire-test-editor-no-t',
      schema: () => [{ name: 'legacy_field', selector: { text: {} } }],
    };
    const el = await mountCard(
      'carnet-scolaire-card-editor-test',
      { device_id: 'dev_enfant' },
      makeHass([]),
      { spec: SPEC_NO_T }
    );
    expect(el.shadowRoot?.querySelector('ha-form')).not.toBeNull();
  });
});
