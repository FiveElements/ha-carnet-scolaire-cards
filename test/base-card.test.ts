import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { html } from 'lit';
import { defineCard } from '../src/core/registry';
import {
  REFRESH_COOLDOWN_MS,
  REFRESH_REJECTED_COOLDOWN_MS,
  resolveTimeZone,
} from '../src/core/base-card';
import type { CardSpec, RenderCtx } from '../src/core/types';
import { localize } from '../src/localize';
import { makeHass } from './fixtures/hass';
import { mountCard, text } from './fixtures/mount';

const SPEC: CardSpec = {
  type: 'carnet-scolaire-test',
  name: 'Test',
  description: 'Carte de test',
  key: 'test',
  scope: 'child',
  requires: () => ['sensor:next_lesson'],
  optional: () => [],
  schema: () => [],
  render: (ctx) => html`<p class="ok">${ctx.entity('sensor:next_lesson')?.state}</p>`,
};

// Deuxième carte, dédiée à la branche requiresAny : aucune des deux cartes
// de test ne peut couvrir les deux logiques (toutes obligatoires / au moins
// une) avec le même schéma de clés.
const SPEC_ANY: CardSpec = {
  type: 'carnet-scolaire-test-any',
  name: 'Test requiresAny',
  description: 'Carte de test — requiresAny',
  key: 'test',
  scope: 'child',
  requires: () => [],
  requiresAny: () => ['sensor:a', 'sensor:b'],
  optional: () => [],
  schema: () => [],
  render: (ctx) =>
    html`<p class="ok">${ctx.entity('sensor:a')?.state ?? ctx.entity('sensor:b')?.state}</p>`,
};

// Deux clés requises, et des ancres alternatives en plus : la forme qu'aucune
// carte n'a encore, et que le socle doit pourtant tenir.
const SPEC_TWO: CardSpec = {
  type: 'carnet-scolaire-test-two',
  name: 'Test deux requises',
  description: 'Carte de test — deux clés requises et requiresAny',
  key: 'test',
  scope: 'child',
  requires: () => ['sensor:a', 'sensor:b'],
  requiresAny: () => ['sensor:c', 'sensor:d'],
  optional: () => [],
  schema: () => [],
  render: (ctx) => html`<p class="ok">${ctx.entity('sensor:a')?.state}/${ctx.entity('sensor:b')?.state}</p>`,
};

// Rend le fuseau résolu : de quoi voir qu'un changement de fuseau repeint.
const SPEC_TZ: CardSpec = {
  type: 'carnet-scolaire-tz',
  name: 'Test fuseau',
  description: 'Carte de test — fuseau',
  key: 'test',
  scope: 'child',
  requires: () => ['sensor:next_lesson'],
  optional: () => [],
  schema: () => [],
  render: (ctx) => html`<p class="ok">${ctx.timeZone}</p>`,
};

const btnOf = (el: Element) => el.shadowRoot?.querySelector('button.refresh-btn');

const mountRefreshCard = (hass: ReturnType<typeof makeHass>) =>
  mountCard(
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SPEC_REFRESH (plus bas) est enregistrée dynamiquement ; ce fichier de test n'augmente pas HTMLElementTagNameMap pour cette balise supplémentaire.
    'carnet-scolaire-test-refresh' as 'carnet-scolaire-test',
    { device_id: 'dev_enfant' },
    hass
  );

const probeRefresh = (hass: ReturnType<typeof makeHass>): void => {
  hass.states['sensor.abc_refresh_probe'] = {
    entity_id: 'sensor.abc_refresh_probe',
    state: 'ready',
    attributes: {},
    last_changed: '2026-09-08T07:00:00+00:00',
    last_updated: '2026-09-08T07:00:00+00:00',
  };
  hass.entities['sensor.abc_refresh_probe'] = {
    entity_id: 'sensor.abc_refresh_probe',
    device_id: 'dev_enfant',
    labels: [],
    platform: 'carnet_scolaire',
    translation_key: 'refresh_probe',
    has_entity_name: true,
  };
};

const withNextLessonEntity = () =>
  makeHass([
    {
      key: 'sensor:next_lesson',
      entity_id: 'sensor.abc_prochain_cours',
      device: 'dev_enfant',
      state: '2026-09-08T08:30:00+02:00',
    },
  ]);

interface TestCardElement extends HTMLElement {
  setConfig(config: unknown): void;
  hass: unknown;
  readonly updateComplete: Promise<unknown>;
}

declare global {
  interface HTMLElementTagNameMap {
    'carnet-scolaire-test': TestCardElement;
    'carnet-scolaire-test-any': TestCardElement;
    'carnet-scolaire-test-two': TestCardElement;
    'carnet-scolaire-tz': TestCardElement;
  }
}

beforeAll(() => {
  defineCard(SPEC);
  defineCard(SPEC_ANY);
  defineCard(SPEC_TWO);
  defineCard(SPEC_TZ);
});

const ent = (key: string, state: string) => ({
  key,
  entity_id: key.replace(':', '.abc_'),
  device: 'dev_enfant' as const,
  state,
  attributes: {},
});

describe('CarnetCardBase — toutes les clés requises, pas une seule', () => {
  it('ne rend pas la carte quand une seule des deux clés requises est exploitable', async () => {
    const hass = makeHass([
      ent('sensor:a', '1'),
      ent('sensor:b', 'unknown'),
      ent('sensor:c', '1'),
    ]);
    const el = await mountCard('carnet-scolaire-test-two', { device_id: 'dev_enfant' }, hass);
    const t = text(el);
    expect(t).toContain('pas encore collectée');
    expect(el.shadowRoot?.querySelector('p.ok')).toBeNull();
  });

  it('vérifie encore les clés requises quand requiresAny est déclaré', async () => {
    const hass = makeHass([ent('sensor:c', '1')]);
    const el = await mountCard('carnet-scolaire-test-two', { device_id: 'dev_enfant' }, hass);
    const t = text(el);
    expect(t).toContain('sensor:a');
    expect(el.shadowRoot?.querySelector('p.ok')).toBeNull();
  });

  it('rend la carte quand les deux requises et une ancre sont exploitables', async () => {
    const hass = makeHass([ent('sensor:a', '1'), ent('sensor:b', '2'), ent('sensor:d', '3')]);
    const el = await mountCard('carnet-scolaire-test-two', { device_id: 'dev_enfant' }, hass);
    expect(el.shadowRoot?.querySelector('p.ok')?.textContent).toBe('1/2');
  });
});

describe('CarnetCardBase — les trois états', () => {
  it('rend la carte quand la donnée est là', async () => {
    const hass = makeHass([
      {
        key: 'sensor:next_lesson',
        entity_id: 'sensor.abc_prochain_cours',
        device: 'dev_enfant',
        state: '2026-09-08T08:30:00+02:00',
      },
    ]);
    const el = await mountCard('carnet-scolaire-test', { device_id: 'dev_enfant' }, hass);
    expect(el.shadowRoot?.querySelector('.ok')).not.toBeNull();
  });

  it('dit « entité absente » et nomme la clé attendue', async () => {
    const hass = makeHass([]);
    const el = await mountCard('carnet-scolaire-test', { device_id: 'dev_enfant' }, hass);
    expect(text(el)).toContain('sensor:next_lesson');
    expect(el.shadowRoot?.querySelector('.ok')).toBeNull();
  });

  it('se repeint quand l’entité apparaît au registre après coup — pas seulement quand son état change', async () => {
    // Reproduit exactement la boucle frustrante que shouldUpdate doit éviter :
    // le propriétaire active le palier correspondant, l'entité apparaît au
    // registre. hass.entities change d'identité ; hass.states aussi, pour une
    // entité qui n'était même pas dans l'ancien this.resolved (elle en était
    // absente). Si shouldUpdate ignore le registre, ce test échoue.
    const el = await mountCard('carnet-scolaire-test', { device_id: 'dev_enfant' }, makeHass([]));
    expect(text(el)).toContain('sensor:next_lesson');
    expect(el.shadowRoot?.querySelector('.ok')).toBeNull();

    el.hass = makeHass([
      {
        key: 'sensor:next_lesson',
        entity_id: 'sensor.abc_prochain_cours',
        device: 'dev_enfant',
        state: '2026-09-08T08:30:00+02:00',
      },
    ]);
    await el.updateComplete;

    expect(el.shadowRoot?.querySelector('.ok')).not.toBeNull();
    expect(text(el)).not.toContain('sensor:next_lesson');
  });

  it('se repeint quand la langue change, sans aucun changement d’état ni de registre', async () => {
    // Le frontal remplace `hass` en gardant `states`, `entities` et `devices`
    // quand l'utilisateur change de langue dans son profil : shouldUpdate ne
    // regardait que ces trois-là, et la carte gardait l'ancienne langue.
    const hass = makeHass([]);
    const el = await mountCard('carnet-scolaire-test', { device_id: 'dev_enfant' }, hass);
    expect(text(el)).toContain(localize('common.missing_hint', undefined, 'fr'));
    el.hass = { ...hass, language: 'it', locale: { language: 'it', time_zone: 'server' } };
    await el.updateComplete;
    expect(text(el)).toContain(localize('common.missing_hint', undefined, 'it'));
  });

  it('se repeint quand le fuseau de l’instance change, sans aucun changement d’état', async () => {
    const hass = withNextLessonEntity();
    const el = await mountCard('carnet-scolaire-tz', { device_id: 'dev_enfant' }, hass);
    expect(text(el)).toContain('Europe/Paris');
    el.hass = { ...hass, config: { time_zone: 'America/Martinique' } };
    await el.updateComplete;
    expect(text(el)).toContain('America/Martinique');
  });

  it('dit « indisponible » quand l’entité existe mais n’a pas d’état', async () => {
    const hass = makeHass([
      {
        key: 'sensor:next_lesson',
        entity_id: 'sensor.abc_prochain_cours',
        device: 'dev_enfant',
        state: 'unavailable',
      },
    ]);
    const el = await mountCard('carnet-scolaire-test', { device_id: 'dev_enfant' }, hass);
    expect(text(el)).toContain('pas encore collectée');
  });

  it('distingue « au registre mais non chargée » de « absente »', async () => {
    const hass = makeHass([
      {
        key: 'sensor:next_lesson',
        entity_id: 'sensor.abc_prochain_cours',
        device: 'dev_enfant',
        unloaded: true,
      },
    ]);
    const el = await mountCard('carnet-scolaire-test', { device_id: 'dev_enfant' }, hass);
    expect(text(el)).toContain('pas encore collectée');
    expect(text(el)).not.toContain('introuvable');
  });

  it('demande de choisir un enfant sans device_id', async () => {
    const el = await mountCard('carnet-scolaire-test', {}, makeHass([]));
    expect(text(el)).toContain('Choisissez un enfant');
  });

  it("affiche « cet appareil n'existe plus » quand device_id est inconnu du registre", async () => {
    const el = await mountCard('carnet-scolaire-test', { device_id: 'dev_disparu' }, makeHass([]));
    expect(text(el)).toContain("n'existe plus");
  });

  it('résout via la surcharge config.entities même sans registre', async () => {
    const hass = makeHass([]);
    hass.states['sensor.override'] = {
      entity_id: 'sensor.override',
      state: 'valeur-directe',
      attributes: {},
      last_changed: '2026-09-08T07:00:00+00:00',
      last_updated: '2026-09-08T07:00:00+00:00',
    };
    const el = await mountCard(
      'carnet-scolaire-test',
      { device_id: 'dev_enfant', entities: { 'sensor:next_lesson': 'sensor.override' } },
      hass
    );
    expect(el.shadowRoot?.querySelector('.ok')?.textContent).toBe('valeur-directe');
  });

  it('dit « introuvable » pour une surcharge qui ne désigne rien, ni au registre ni dans les états', async () => {
    // Une faute de frappe dans `entities` résolvait la clé vers une entité
    // inexistante : la carte affichait « pas encore collectée », présenté
    // comme transitoire, et le restait pour toujours.
    const el = await mountCard(
      'carnet-scolaire-test',
      { device_id: 'dev_enfant', entities: { 'sensor:next_lesson': 'sensor.abc_prochain_cour' } },
      makeHass([])
    );
    const t = text(el);
    expect(t).toContain('sensor:next_lesson');
    expect(t).not.toContain('pas encore collectée');
  });

  it('garde une surcharge inscrite au registre même sans état chargé', async () => {
    const hass = makeHass([
      { key: 'sensor:autre', entity_id: 'sensor.override', device: 'dev_enfant', unloaded: true },
    ]);
    const el = await mountCard(
      'carnet-scolaire-test',
      { device_id: 'dev_enfant', entities: { 'sensor:next_lesson': 'sensor.override' } },
      hass
    );
    expect(text(el)).toContain('pas encore collectée');
  });

  it('valide la présence du champ type', () => {
    const el = document.createElement('carnet-scolaire-test');
    expect(() => el.setConfig({})).toThrow();
  });

  it('rend dans la langue de Home Assistant, pas en français par défaut', async () => {
    // Monte une carte dont l'entité requise est absente, en italien : le message
    // « donnée pas encore collectée / introuvable » doit venir du catalogue italien.
    const el = await mountCard('carnet-scolaire-test', { device_id: 'dev_enfant' }, makeHass([], 'it'));
    const out = text(el);
    expect(out).toContain('Entità non trovata su questo dispositivo:');
    expect(out).not.toContain('Entité introuvable');
  });

  describe('requiresAny', () => {
    it('aucune des clés ne résout → « entité absente »', async () => {
      const el = await mountCard('carnet-scolaire-test-any', { device_id: 'dev_enfant' }, makeHass([]));
      expect(text(el)).toContain('sensor:a');
      expect(text(el)).toContain('sensor:b');
      expect(el.shadowRoot?.querySelector('.ok')).toBeNull();
    });

    it('une clé résout mais sans état exploitable → « indisponible »', async () => {
      const hass = makeHass([
        { key: 'sensor:a', entity_id: 'sensor.abc_a', device: 'dev_enfant', state: 'unavailable' },
      ]);
      const el = await mountCard('carnet-scolaire-test-any', { device_id: 'dev_enfant' }, hass);
      expect(text(el)).toContain('pas encore collectée');
    });
  });

  it('getConfigElement crée un éditeur porteur de la spec de la carte', () => {
    const ctor = customElements.get('carnet-scolaire-test');
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- `getConfigElement` est un statique propre aux cartes Carnet scolaire, absent de l'interface DOM générique CustomElementConstructor.
    const el = (ctor as unknown as { getConfigElement(): HTMLElement }).getConfigElement();
    expect(el.tagName.toLowerCase()).toBe('carnet-scolaire-card-editor');
  });
});

describe('RenderCtx — la promesse de sécurité de docs/limites.md est vraie côté type', () => {
  it('ctx.hass n’expose pas callService : vérifié à la compilation, pas seulement documenté', () => {
    // Une carte qui écrirait `ctx.hass.callService(...)` ne compile plus :
    // c'est exactement l'écart entre docs/limites.md et le type d'avant
    // cette correction. `npm run typecheck` échoue si la ligne suivante ne
    // déclenche plus d'erreur (directive @ts-expect-error inutilisée).
    const spec: CardSpec = {
      type: 'carnet-scolaire-test-hassview',
      name: 'Test',
      description: 'Carte de test',
      key: 'test',
      scope: 'child',
      requires: () => [],
      optional: () => [],
      schema: () => [],
      render: (ctx) => {
        // @ts-expect-error callService est absent de HassView (types.ts) : ctx.hass n'est plus un moyen d'appeler un service.
        void ctx.hass.callService;
        return html``;
      },
    };
    expect(spec.type).toBe('carnet-scolaire-test-hassview');
  });

  it('ctx.callService refuse à la compilation un appel hors de la liste close AllowedCall', () => {
    const spec: CardSpec = {
      type: 'carnet-scolaire-test-allowedcall',
      name: 'Test',
      description: 'Carte de test',
      key: 'test',
      scope: 'child',
      requires: () => [],
      optional: () => [],
      schema: () => [],
      render: (ctx) => {
        // @ts-expect-error 'light.turn_on' n'appartient pas à AllowedCall (types.ts) : seuls carnet_scolaire.refresh et todo.update_item le sont.
        void ctx.callService('light.turn_on');
        return html``;
      },
    };
    expect(spec.type).toBe('carnet-scolaire-test-allowedcall');
  });

  it('expose ctx.language et ctx.timeZone comme commodités dérivées de hass', async () => {
    let captured: RenderCtx | undefined;
    const spec: CardSpec = {
      type: 'carnet-scolaire-test-lang',
      name: 'Test',
      description: 'Carte de test',
      key: 'test',
      scope: 'child',
      requires: () => [],
      optional: () => [],
      schema: () => [],
      render: (ctx) => {
        captured = ctx;
        return html``;
      },
    };
    defineCard(spec);
    const hass = makeHass([], 'it');
    await mountCard(
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- ce spec est enregistré ci-dessus ; ce fichier de test n'augmente pas HTMLElementTagNameMap pour cette balise supplémentaire.
      'carnet-scolaire-test-lang' as 'carnet-scolaire-test',
      { device_id: 'dev_enfant' },
      hass
    );
    expect(captured?.language).toBe('it');
    expect(captured?.timeZone).toBe('Europe/Paris');
  });
});

describe('ctx.refresh — chemin d’échec et horodatage', () => {
  const SPEC_REFRESH: CardSpec = {
    type: 'carnet-scolaire-test-refresh',
    name: 'Test',
    description: 'Carte de test — refresh',
    key: 'test',
    scope: 'child',
    requires: () => ['sensor:refresh_probe'],
    optional: () => [],
    schema: () => [],
    render: (ctx) => html`
      <button
        class="refresh-btn"
        ?disabled=${ctx.refreshCoolingDown}
        @click=${() => {
          void ctx.refresh();
        }}
      ></button>
      <p class="failed">${ctx.refreshFailed ? 'échoué' : 'ok'}</p>
    `,
  };

  beforeAll(() => {
    defineCard(SPEC_REFRESH);
  });

  // La garde vit dans `localStorage`, donc elle FUIT d'un cas au suivant. Sans
  // ce nettoyage, un test de garde rendue mesurerait celle qu'un cas
  // précédent a laissée, et le premier cas ci-dessous — qui affirme que le
  // bouton part non grisé — tenait par l'ordre d'exécution seul.
  beforeEach(() => {
    globalThis.localStorage?.clear();
  });

  const CLE_GARDE = 'carnet-scolaire-cards:refreshed-at:dev_enfant';

  it('pose refreshedAt avant l’appel : le bouton se grise dès le clic, avant même la résolution du service', async () => {
    const hass = makeHass([]);
    probeRefresh(hass);
    let resolveCall: (() => void) | undefined;
    hass.callService = () =>
      new Promise((resolve) => {
        resolveCall = () => resolve(undefined);
      });
    const el = await mountRefreshCard(hass);
    const btn = () => el.shadowRoot?.querySelector('button.refresh-btn');
    expect(btn()?.hasAttribute('disabled')).toBe(false);

    btn()?.dispatchEvent(new MouseEvent('click'));
    // this.refreshedAt est posé de façon synchrone, avant le premier await
    // de refresh() : le nouveau rendu doit déjà griser le bouton.
    await el.updateComplete;
    expect(btn()?.hasAttribute('disabled')).toBe(true);

    resolveCall?.();
  });

  it('entoure l’appel d’un try/catch et expose l’échec sur refreshFailed, sans laisser le rejet filer sans traitement', async () => {
    const hass = makeHass([]);
    probeRefresh(hass);
    hass.callService = () => Promise.reject(new Error('service indisponible'));
    const el = await mountRefreshCard(hass);
    expect(text(el)).toContain('ok');

    el.shadowRoot?.querySelector('button.refresh-btn')?.dispatchEvent(new MouseEvent('click'));
    await el.updateComplete;
    // Laisse le rejet se propager jusqu'au catch avant de vérifier le rendu.
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;

    expect(text(el)).toContain('échoué');
  });

  it('raccourcit la garde à une minute quand l’appel est rejeté', async () => {
    // Mesuré sur l'instance du propriétaire le 10 septembre 2026, avant le
    // correctif de `device_id` : le service rejetait l'appel, et la garde
    // verrouillait quand même le bouton un quart d'heure — un utilisateur
    // puni pour une demande qui n'était jamais partie.
    //
    // Rendue, mais pas à zéro, et le milieu n'est pas une précaution : sur
    // un palier en échec, l'intégration n'arme jamais le plafond du boost
    // (`boost_served_at` n'est posé que dans `mark_collected`) et `request()`
    // efface le plancher de `mark_failed`. Chaque clic accepté y achète une
    // requête réelle. Voir `REFRESH_REJECTED_COOLDOWN_MS`.
    const hass = makeHass([]);
    probeRefresh(hass);
    hass.callService = () => Promise.reject(new Error('value should be a string'));
    const el = await mountRefreshCard(hass);

    btnOf(el)?.dispatchEvent(new MouseEvent('click'));
    // Grisé dès le clic : la protection contre le double-clic ne change pas.
    await el.updateComplete;
    expect(btnOf(el)?.hasAttribute('disabled')).toBe(true);

    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
    // Toujours grisé — mais plus pour un quart d'heure. C'est le TEMPS
    // RESTANT qui porte la mesure : un test sur `disabled` seul ne
    // distinguerait pas une minute de quinze.
    expect(btnOf(el)?.hasAttribute('disabled')).toBe(true);
    const restant = REFRESH_COOLDOWN_MS - (Date.now() - Number(localStorage.getItem(CLE_GARDE)));
    expect(restant).toBeGreaterThan(0);
    expect(restant).toBeLessThanOrEqual(REFRESH_REJECTED_COOLDOWN_MS);
    // Appariement positif : l'échec affiché prouve que le clic est bien allé
    // jusqu'au bout du chemin de rejet, et pas qu'un rendu n'a rien vu.
    expect(text(el)).toContain('échoué');
  });

  it('raccourcit aussi la garde PARTAGÉE, celle qui survit au rechargement', async () => {
    // La garde de l'instance et celle du stockage sont deux choses, et c'est
    // la seconde qui survit à un rechargement de page. N'en raccourcir qu'une
    // laisserait le quart d'heure revenir au prochain affichage.
    const hass = makeHass([]);
    probeRefresh(hass);
    hass.callService = () => Promise.reject(new Error('rejet'));
    const first = await mountRefreshCard(hass);
    btnOf(first)?.dispatchEvent(new MouseEvent('click'));
    await new Promise((r) => setTimeout(r, 0));
    await first.updateComplete;

    const restant = REFRESH_COOLDOWN_MS - (Date.now() - Number(localStorage.getItem(CLE_GARDE)));
    expect(restant).toBeGreaterThan(0);
    expect(restant).toBeLessThanOrEqual(REFRESH_REJECTED_COOLDOWN_MS);
    // Et un remontage relit cette garde-là, pas celle de l'instance perdue.
    const second = await mountRefreshCard(hass);
    expect(btnOf(second)?.hasAttribute('disabled')).toBe(true);
  });

  it('ne rend PAS la garde qu’une carte voisine a reprise entre-temps', async () => {
    // Deux cartes du même appareil peuvent être sur la même vue. Si la
    // voisine arme la garde pendant que notre appel est en vol, et que le
    // nôtre échoue, restaurer sans regarder effacerait un verrou légitime —
    // pour un appel qui, lui, a réussi.
    const hass = makeHass([]);
    probeRefresh(hass);
    hass.callService = () => {
      // La voisine arme la garde APRÈS nous, avec un horodatage plus récent.
      globalThis.localStorage.setItem(CLE_GARDE, String(Date.now() + 1000));
      return Promise.reject(new Error('rejet'));
    };
    const el = await mountRefreshCard(hass);
    btnOf(el)?.dispatchEvent(new MouseEvent('click'));
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;

    // Notre instance oublie sa propre garde — c'est notre appel qui a
    // échoué — mais la garde partagée reste celle de la voisine.
    const restee = Number(globalThis.localStorage.getItem(CLE_GARDE));
    expect(restee).toBeGreaterThan(Date.now());
    // Et un remontage la relit, donc le bouton repart grisé.
    const second = await mountRefreshCard(hass);
    expect(btnOf(second)?.hasAttribute('disabled')).toBe(true);
  });

  it('garde le bouton grisé après un remontage : un rechargement de page ne réarme pas avant l’heure', async () => {
    // La garde vivait en mémoire d'instance : recharger l'onglet réarmait le
    // bouton alors que le serveur refusait toujours le boost. L'utilisateur
    // appuyait, rien ne se passait, il recommençait — sur un serveur qui
    // sanctionne l'adresse IP.
    const hass = makeHass([]);
    probeRefresh(hass);
    hass.callService = () => Promise.resolve(undefined);

    const first = await mountRefreshCard(hass);
    btnOf(first)?.dispatchEvent(new MouseEvent('click'));
    await first.updateComplete;
    expect(btnOf(first)?.hasAttribute('disabled')).toBe(true);

    // Nouveau montage : l'instance précédente et son refreshedAt sont perdus,
    // exactement comme après un rechargement de page.
    const second = await mountRefreshCard(hass);
    expect(btnOf(second)?.hasAttribute('disabled')).toBe(true);
  });
});

describe('spec.tickMs — minuterie déclarative pour les rendus qui dépendent de Date.now()', () => {
  const SPEC_TICK: CardSpec = {
    type: 'carnet-scolaire-test-tick',
    name: 'Test',
    description: 'Carte de test — tick',
    key: 'test',
    scope: 'child',
    tickMs: 1000,
    requires: () => ['sensor:next_lesson'],
    optional: () => [],
    schema: () => [],
    render: () => html`<p class="ok">${Date.now()}</p>`,
  };

  beforeAll(() => {
    defineCard(SPEC_TICK);
  });

  it('ne pose aucun intervalle quand spec.tickMs est absent', async () => {
    const setSpy = vi.spyOn(globalThis, 'setInterval');
    await mountCard('carnet-scolaire-test', { device_id: 'dev_enfant' }, withNextLessonEntity());
    expect(setSpy).not.toHaveBeenCalled();
    setSpy.mockRestore();
  });

  it('pose un intervalle à connectedCallback quand spec.tickMs est défini, et le retire à disconnectedCallback', async () => {
    const setSpy = vi.spyOn(globalThis, 'setInterval');
    const clearSpy = vi.spyOn(globalThis, 'clearInterval');
    const el = await mountCard(
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SPEC_TICK est enregistrée ci-dessus ; ce fichier de test n'augmente pas HTMLElementTagNameMap pour cette balise supplémentaire.
      'carnet-scolaire-test-tick' as 'carnet-scolaire-test',
      { device_id: 'dev_enfant' },
      withNextLessonEntity()
    );
    expect(setSpy).toHaveBeenCalledTimes(1);
    expect(setSpy.mock.calls[0]?.[1]).toBe(1000);
    const timerId = setSpy.mock.results[0]?.value;

    // Une fuite d'intervalle sur un tableau de bord ouvert en permanence est
    // un vrai défaut : il doit disparaître exactement au détachement.
    el.remove();
    expect(clearSpy).toHaveBeenCalledWith(timerId);

    setSpy.mockRestore();
    clearSpy.mockRestore();
  });

  it('repeint périodiquement sans qu’aucune propriété réactive ne change', async () => {
    vi.useFakeTimers();
    try {
      const el = await mountCard(
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SPEC_TICK est enregistrée ci-dessus ; ce fichier de test n'augmente pas HTMLElementTagNameMap pour cette balise supplémentaire.
        'carnet-scolaire-test-tick' as 'carnet-scolaire-test',
        { device_id: 'dev_enfant' },
        withNextLessonEntity()
      );
      const before = el.shadowRoot?.querySelector('.ok')?.textContent;
      vi.advanceTimersByTime(1000);
      await el.updateComplete;
      const after = el.shadowRoot?.querySelector('.ok')?.textContent;
      expect(after).not.toBe(before);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('resolveTimeZone', () => {
  // `hass.locale.time_zone` est une PRÉFÉRENCE, pas un identifiant IANA. La
  // passer telle quelle à `Intl.DateTimeFormat` lève une `RangeError`, et une
  // exception dans `render()` laisse la carte entièrement vide : c'est
  // exactement la panne observée sur une instance réelle, où la valeur vaut
  // « local » par défaut.
  const browser = new Intl.DateTimeFormat().resolvedOptions().timeZone;

  it('rend le fuseau du navigateur sur la préférence « local »', () => {
    const tz = resolveTimeZone({
      locale: { time_zone: 'local' },
      config: { time_zone: 'Asia/Tokyo' },
    });
    expect(tz).toBe(browser);
    expect(() => new Intl.DateTimeFormat('fr', { timeZone: tz })).not.toThrow();
  });

  it('rend le fuseau de l’instance sur la préférence « server »', () => {
    expect(
      resolveTimeZone({ locale: { time_zone: 'server' }, config: { time_zone: 'Asia/Tokyo' } })
    ).toBe('Asia/Tokyo');
  });

  it('retombe sur le navigateur quand « server » ne publie aucun fuseau', () => {
    expect(resolveTimeZone({ locale: { time_zone: 'server' } })).toBe(browser);
  });

  it('n’émet jamais un fuseau que `Intl` refuse', () => {
    for (const locale of [{ time_zone: 'Pas/Un/Fuseau' }, { time_zone: '' }, undefined]) {
      const tz = resolveTimeZone({ locale });
      expect(() => new Intl.DateTimeFormat('fr', { timeZone: tz })).not.toThrow();
    }
  });

  it('accepte un identifiant IANA écrit directement dans la préférence', () => {
    expect(resolveTimeZone({ locale: { time_zone: 'Europe/Paris' } })).toBe('Europe/Paris');
  });
});

describe('rendu qui lève', () => {
  const SPEC_THROWS: CardSpec = {
    type: 'carnet-scolaire-test-throws',
    name: 'Test exception',
    description: 'Carte de test — render qui lève',
    key: 'test',
    scope: 'child',
    requires: () => ['sensor:next_lesson'],
    optional: () => [],
    schema: () => [],
    render: () => {
      throw new Error('boum');
    },
  };

  it('affiche un message plutôt que de disparaître de la page', async () => {
    defineCard(SPEC_THROWS);
    const erreurs = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const el = await mountCard(
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SPEC_THROWS est enregistrée juste au-dessus ; ce fichier de test n'augmente pas HTMLElementTagNameMap pour cette balise supplémentaire.
        'carnet-scolaire-test-throws' as 'carnet-scolaire-test',
        { device_id: 'dev_enfant' },
        withNextLessonEntity()
      );
      // Sans le filet, Lit laisse la racine d'ombre VIDE : l'assertion
      // positive est celle qui compte.
      expect(text(el)).toContain("Cette carte n'a pas pu s'afficher.");
      expect(erreurs).toHaveBeenCalled();
    } finally {
      erreurs.mockRestore();
    }
  });
});

describe('defineCard', () => {
  it('enregistre la carte dans window.customCards', () => {
    const cards = window.customCards ?? [];
    expect(cards.some((c) => c.type === 'carnet-scolaire-test')).toBe(true);
  });
  it('enregistre aussi l’éditeur', () => {
    expect(customElements.get('carnet-scolaire-card-editor')).toBeDefined();
  });
});
