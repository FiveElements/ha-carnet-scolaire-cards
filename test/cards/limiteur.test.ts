import { beforeAll, describe, expect, it, vi } from 'vitest';
import { defineCard } from '../../src/core/registry';
import { SPEC } from '../../src/cards/limiteur';
import { makeHass } from '../fixtures/hass';
import { mountCard, text } from '../fixtures/mount';

declare global {
  interface HTMLElementTagNameMap {
    'carnet-scolaire-limiteur': HTMLElement & {
      setConfig(c: unknown): void;
      hass: unknown;
      readonly updateComplete: Promise<unknown>;
    };
  }
}

beforeAll(() => {
  defineCard(SPEC);
});

const compte = (key: string, entity_id: string, state: string, attributes = {}) => ({
  key,
  entity_id,
  device: 'dev_compte' as const,
  state,
  attributes,
});

describe('carte limiteur', () => {
  it("résout les entités de compte depuis le device_id de l'enfant", async () => {
    const hass = makeHass([compte('sensor:limiter_state', 'sensor.cpt_etat', 'nominal')]);
    const el = await mountCard('carnet-scolaire-limiteur', { device_id: 'dev_enfant' }, hass);
    expect(text(el)).toContain('Nominal');
  });

  it('affiche budget, appels par palier et paliers en attente', async () => {
    const hass = makeHass([
      compte('sensor:limiter_state', 'sensor.cpt_etat', 'throttled', { reason: 'quota' }),
      compte('sensor:remaining_budget', 'sensor.cpt_budget', '120', { daily_cap: 400 }),
      compte('sensor:calls_today', 'sensor.cpt_appels', '280', {
        by_tier: { timetable: 100, marks: 80 },
      }),
      compte('sensor:next_collection', 'sensor.cpt_prochaine', '2026-09-08T09:00:00+02:00', {
        tiers_due: ['marks'],
      }),
    ]);
    const el = await mountCard('carnet-scolaire-limiteur', { device_id: 'dev_enfant' }, hass);
    const t = text(el);
    expect(t).toContain('Bridé');
    expect(t).toContain('120');
    expect(t).toContain('400');
    expect(t).toContain('timetable');
    expect(t).toContain('marks');
  });

  it('donne le jour d’une suspension qui ne se lève pas aujourd’hui', async () => {
    // « jusqu'à 06:00 » pour une suspension de plusieurs jours se lisait
    // comme « ce matin ». Une date lointaine : jamais aujourd'hui.
    const hass = makeHass([
      compte('sensor:limiter_state', 'sensor.cpt_etat', 'suspended', {
        until: '2099-01-05T06:00:00+01:00',
      }),
    ]);
    const el = await mountCard('carnet-scolaire-limiteur', { device_id: 'dev_enfant' }, hass);
    const t = text(el);
    expect(t).toContain('06:00');
    expect(t).toContain('5 janvier');
  });

  it("n'affiche pas les connexions du jour quand l'entité est absente", async () => {
    const hass = makeHass([compte('sensor:limiter_state', 'sensor.cpt_etat', 'nominal')]);
    const el = await mountCard('carnet-scolaire-limiteur', { device_id: 'dev_enfant' }, hass);
    expect(text(el)).not.toContain('Connexions depuis minuit');
    // Assertion positive appariée : sans elle, ce test passerait aussi sur un rendu entièrement cassé.
    expect(text(el)).toContain('Nominal');
  });

  it('affiche les connexions du jour quand `sensor:logins_today` est résolue', async () => {
    const hass = makeHass([
      compte('sensor:limiter_state', 'sensor.cpt_etat', 'nominal'),
      compte('sensor:logins_today', 'sensor.cpt_connexions', '3'),
    ]);
    const el = await mountCard('carnet-scolaire-limiteur', { device_id: 'dev_enfant' }, hass);
    const t = text(el);
    expect(t).toContain('Connexions depuis minuit');
    expect(t).toContain('3');
  });

  it("n'affiche pas l'âge de la session quand l'entité est absente", async () => {
    const hass = makeHass([compte('sensor:limiter_state', 'sensor.cpt_etat', 'nominal')]);
    const el = await mountCard('carnet-scolaire-limiteur', { device_id: 'dev_enfant' }, hass);
    expect(text(el)).not.toContain('Âge de la session');
    // Assertion positive appariée : sans elle, ce test passerait aussi sur un rendu entièrement cassé.
    expect(text(el)).toContain('Nominal');
  });

  it("affiche l'âge de la session mis en forme, dans l'unité que l'entité déclare", async () => {
    const hass = makeHass([
      compte('sensor:limiter_state', 'sensor.cpt_etat', 'nominal'),
      // La forme RÉELLE : l'âge de la session est publié en SECONDES.
      compte('sensor:session_age', 'sensor.cpt_age', '2700', { unit_of_measurement: 's' }),
    ]);
    const el = await mountCard('carnet-scolaire-limiteur', { device_id: 'dev_enfant' }, hass);
    const t = text(el);
    expect(t).toContain('Âge de la session');
    // La mise en forme, pas la valeur brute : « 45 min », jamais « 2700 » nu.
    expect(t).toContain('45 min');
  });

  it("ne prend pas les secondes de l'âge de session pour des minutes", async () => {
    const hass = makeHass([
      compte('sensor:limiter_state', 'sensor.cpt_etat', 'nominal'),
      // 1743 secondes, soit 29 minutes. Relevé sur une instance réelle, où la
      // carte affichait « 22 h 33 » — un facteur 60, et un nombre assez
      // plausible pour n'alerter personne.
      compte('sensor:session_age', 'sensor.cpt_age', '1743', { unit_of_measurement: 's' }),
    ]);
    const el = await mountCard('carnet-scolaire-limiteur', { device_id: 'dev_enfant' }, hass);
    const t = text(el);
    expect(t).toContain('29 min');
    expect(t).not.toContain('22 h');
  });

  it("montre la valeur brute plutôt qu'une durée fausse quand l'unité n'est pas reconnue", async () => {
    const hass = makeHass([
      compte('sensor:limiter_state', 'sensor.cpt_etat', 'nominal'),
      compte('sensor:session_age', 'sensor.cpt_age', '42', { unit_of_measurement: 'quinzaines' }),
    ]);
    const el = await mountCard('carnet-scolaire-limiteur', { device_id: 'dev_enfant' }, hass);
    const t = text(el);
    expect(t).toContain('42 quinzaines');
    // Surtout pas une conversion inventée.
    expect(t).not.toContain('42 min');
  });

  it("n'affiche pas la durée de vie de la session quand l'entité est absente", async () => {
    const hass = makeHass([compte('sensor:limiter_state', 'sensor.cpt_etat', 'nominal')]);
    const el = await mountCard('carnet-scolaire-limiteur', { device_id: 'dev_enfant' }, hass);
    expect(text(el)).not.toContain('Durée de vie de la session');
    // Assertion positive appariée : sans elle, ce test passerait aussi sur un rendu entièrement cassé.
    expect(text(el)).toContain('Nominal');
  });

  it('affiche la durée de vie de la session mise en forme (heures) quand `sensor:session_lifetime` est résolue', async () => {
    const hass = makeHass([
      compte('sensor:limiter_state', 'sensor.cpt_etat', 'nominal'),
      // La forme RÉELLE : la durée de vie, elle, est publiée en MINUTES.
      // Les deux capteurs de session n'ont pas la même unité — c'est
      // précisément le piège que ces tests verrouillent.
      compte('sensor:session_lifetime', 'sensor.cpt_duree', '135', {
        unit_of_measurement: 'min',
      }),
    ]);
    const el = await mountCard('carnet-scolaire-limiteur', { device_id: 'dev_enfant' }, hass);
    const t = text(el);
    expect(t).toContain('Durée de vie de la session');
    // La mise en forme, pas la valeur brute : « 2 h 15 », jamais « 135 » nu.
    expect(t).toContain('2 h 15');
  });

  it("n'affiche pas de mention de bridage quand `binary_sensor:throttled` est absente", async () => {
    const hass = makeHass([compte('sensor:limiter_state', 'sensor.cpt_etat', 'nominal')]);
    const el = await mountCard('carnet-scolaire-limiteur', { device_id: 'dev_enfant' }, hass);
    expect(text(el)).not.toContain('Collectes bridées');
    // Assertion positive appariée : sans elle, ce test passerait aussi sur un rendu entièrement cassé.
    expect(text(el)).toContain('Nominal');
  });

  it('affiche la mention de bridage quand `binary_sensor:throttled` est à `on` et que la pastille ne dit pas déjà `throttled`', async () => {
    const hass = makeHass([
      compte('sensor:limiter_state', 'sensor.cpt_etat', 'nominal'),
      compte('binary_sensor:throttled', 'binary_sensor.cpt_bride', 'on'),
    ]);
    const el = await mountCard('carnet-scolaire-limiteur', { device_id: 'dev_enfant' }, hass);
    const t = text(el);
    expect(t).toContain('Nominal');
    expect(t).toContain('Collectes bridées');
  });

  it("n'ajoute pas la mention de bridage quand la pastille dit déjà `throttled` (pas de doublon)", async () => {
    const hass = makeHass([
      compte('sensor:limiter_state', 'sensor.cpt_etat', 'throttled'),
      compte('binary_sensor:throttled', 'binary_sensor.cpt_bride', 'on'),
    ]);
    const el = await mountCard('carnet-scolaire-limiteur', { device_id: 'dev_enfant' }, hass);
    const t = text(el);
    // La pastille porte déjà l'information : positif sur elle...
    expect(t).toContain('Bridé');
    // ...et aucune mention supplémentaire redondante.
    expect(t).not.toContain('Collectes bridées');
  });

  it("n'affiche jamais l'empreinte de session", async () => {
    const hass = makeHass([
      compte('sensor:limiter_state', 'sensor.cpt_etat', 'nominal'),
      compte('sensor:session_age', 'sensor.cpt_age', '3600', {
        session_id_hash: 'abc123',
        opened_at: '2026-09-08T06:00:00+02:00',
      }),
    ]);
    const el = await mountCard('carnet-scolaire-limiteur', { device_id: 'dev_enfant' }, hass);
    const t = text(el);
    // L'absence seule passerait sur un rendu entièrement vide : on l'apparie
    // à une assertion positive prouvant que la carte a bien rendu autre chose.
    expect(t).toContain('Nominal');
    expect(t).not.toContain('abc123');
  });

  it("retombe sur l'état brut pour un état que le catalogue ne connaît pas encore", async () => {
    const hass = makeHass([compte('sensor:limiter_state', 'sensor.cpt_etat', 'maintenance')]);
    const el = await mountCard('carnet-scolaire-limiteur', { device_id: 'dev_enfant' }, hass);
    const t = text(el);
    // Ni la clé technique manquante...
    expect(t).not.toContain('limiteur.state_maintenance');
    // ...ni un repli optimiste : l'état brut, tel quel.
    expect(t).toContain('maintenance');
  });

  it("n'affiche pas le bouton de rafraîchissement quand show_refresh n'est pas posé", async () => {
    const hass = makeHass([compte('sensor:limiter_state', 'sensor.cpt_etat', 'nominal')]);
    const el = await mountCard('carnet-scolaire-limiteur', { device_id: 'dev_enfant' }, hass);
    expect(el.shadowRoot?.querySelector('button')).toBeNull();
    // Assertion positive appariée : sans elle, ce test passerait aussi sur un rendu entièrement cassé.
    expect(text(el)).toContain('Nominal');
  });

  it('appelle carnet_scolaire.refresh sur clic et non au montage', async () => {
    const hass = makeHass([compte('sensor:limiter_state', 'sensor.cpt_etat', 'nominal')]);
    const spy = vi.fn().mockResolvedValue(undefined);
    hass.callService = spy;
    const el = await mountCard(
      'carnet-scolaire-limiteur',
      { device_id: 'dev_enfant', show_refresh: true },
      hass
    );
    expect(spy).not.toHaveBeenCalled();
    // Le sélecteur simple 'button' correspond à l'overload typé de
    // `querySelector` (HTMLButtonElement | null) : pas besoin de conversion.
    const button = el.shadowRoot?.querySelector('button');
    expect(button).not.toBeNull();
    button?.click();
    await el.updateComplete;
    // `device_id` va dans les DONNEES, pas dans la cible, et il n'y a pas de
    // quatrieme argument. `services.yaml` le declare sous `fields:` avec un
    // selecteur `device:`, sans bloc `target:`, et `services.py` valide
    // `vol.Required(ATTR_DEVICE_ID): cv.string`.
    //
    // Ce test a gele la forme du code une deuxieme fois. Passe en cible, le
    // `device_id` etait normalise en LISTE par `cv.TARGET_SERVICE_FIELDS`
    // avant fusion dans les donnees, et le service rejetait chaque clic avec
    // « value should be a string at 'device_id' ». Le test passait, parce
    // qu'il recopiait ce que la carte envoyait.
    expect(spy).toHaveBeenCalledWith('carnet_scolaire', 'refresh', { device_id: 'dev_enfant' }, undefined);
  });

  it("n'appelle pas le service quand la configuration n'a pas de device_id", async () => {
    // `device_id` est requis par le service. Une configuration par surcharge
    // `entities` seule n'en a pas : plutôt qu'un rejet de validation affiché
    // en erreur brute par Home Assistant, la carte n'appelle rien et dit que
    // la demande n'a pas abouti.
    const hass = makeHass([compte('sensor:limiter_state', 'sensor.cpt_etat', 'nominal')]);
    const spy = vi.fn().mockResolvedValue(undefined);
    hass.callService = spy;
    const el = await mountCard(
      'carnet-scolaire-limiteur',
      { entities: { 'sensor:limiter_state': 'sensor.cpt_etat' }, show_refresh: true },
      hass
    );
    const button = el.shadowRoot?.querySelector('button');
    expect(button).not.toBeNull();
    button?.click();
    await el.updateComplete;
    expect(spy).not.toHaveBeenCalled();
    // Appariement positif : une absence d'appel passerait aussi sur un rendu
    // cassé ou un bouton inerte. Le message d'échec prouve que le clic est
    // bien arrivé jusqu'à `refresh`.
    expect(text(el)).toContain("La demande n'a pas abouti");
    // Et la garde n'est PAS armée : rien n'a été demandé, donc le bouton
    // reste cliquable. Un quart d'heure de verrou pour un appel qui n'est
    // jamais parti punirait l'utilisateur d'un défaut de configuration.
    expect(button?.disabled).toBe(false);
  });

  it('transmet le palier choisi à carnet_scolaire.refresh', async () => {
    const hass = makeHass([compte('sensor:limiter_state', 'sensor.cpt_etat', 'nominal')]);
    const spy = vi.fn().mockResolvedValue(undefined);
    hass.callService = spy;
    const el = await mountCard(
      'carnet-scolaire-limiteur',
      { device_id: 'dev_enfant', show_refresh: true, refresh_tier: 'marks' },
      hass
    );
    const button = el.shadowRoot?.querySelector('button');
    button?.click();
    await el.updateComplete;
    // La forme est celle du service, pas celle de l'option de la carte :
    // l'option s'appelle `refresh_tier` au singulier, le champ du service
    // s'appelle `tiers` et prend une liste. Ce test a longtemps gele la
    // MAUVAISE forme, et c'est pour ca qu'il n'a rien vu : un test qui
    // recopie l'hypothese du code au lieu de la contredire ne protege de
    // rien. La forme se verifie dans `services.py` de l'integration.
    expect(spy).toHaveBeenCalledWith(
      'carnet_scolaire',
      'refresh',
      { device_id: 'dev_enfant', tiers: ['marks'] },
      // Le quatrieme argument, la CIBLE, vaut undefined : ce service ne
      // declare pas de bloc target, et une cible y remettrait le device_id
      // sous forme de liste.
      undefined
    );
  });

  it('affiche un avertissement quand la demande de rafraîchissement échoue', async () => {
    const hass = makeHass([compte('sensor:limiter_state', 'sensor.cpt_etat', 'nominal')]);
    hass.callService = vi.fn().mockRejectedValue(new Error('échec simulé'));
    const el = await mountCard(
      'carnet-scolaire-limiteur',
      { device_id: 'dev_enfant', show_refresh: true },
      hass
    );
    const button = el.shadowRoot?.querySelector('button');
    button?.click();
    // ctx.refresh() capture le rejet après avoir attendu hass.callService (une
    // microtâche) : on laisse la file se vider avant de ré-attendre le
    // prochain cycle de rendu de Lit, comme pour le test de garde ci-dessous.
    await new Promise((resolve) => setTimeout(resolve, 0));
    await el.updateComplete;
    expect(el.shadowRoot?.querySelectorAll('.notice.problem').length).toBeGreaterThan(0);
  });

  it('grise le bouton pendant l’intervalle de garde suivant un refresh', async () => {
    const hass = makeHass([compte('sensor:limiter_state', 'sensor.cpt_etat', 'nominal')]);
    hass.callService = vi.fn().mockResolvedValue(undefined);
    const el = await mountCard(
      'carnet-scolaire-limiteur',
      { device_id: 'dev_enfant', show_refresh: true },
      hass
    );
    const button = el.shadowRoot?.querySelector('button');
    expect(button?.disabled).toBe(false);
    button?.click();
    // ctx.refresh() attend d'abord hass.callService (une microtâche) avant de
    // poser refreshedAt : on laisse la file de microtâches se vider avant de
    // ré-attendre le prochain cycle de rendu de Lit.
    await new Promise((resolve) => setTimeout(resolve, 0));
    await el.updateComplete;
    expect(button?.disabled).toBe(true);
  });

  it('dit « pas encore collectée » quand l’entité est indisponible', async () => {
    const hass = makeHass([compte('sensor:limiter_state', 'sensor.cpt_etat', 'unavailable')]);
    const el = await mountCard('carnet-scolaire-limiteur', { device_id: 'dev_enfant' }, hass);
    expect(text(el)).toContain('pas encore collectée');
  });

  it("dit « introuvable » quand l'entité manque", async () => {
    const el = await mountCard('carnet-scolaire-limiteur', { device_id: 'dev_enfant' }, makeHass([]));
    expect(text(el)).toContain('sensor:limiter_state');
  });

  it("dégrade proprement quand `tiers_due` n'est pas un tableau", async () => {
    const hass = makeHass([
      compte('sensor:limiter_state', 'sensor.cpt_etat', 'nominal'),
      compte('sensor:next_collection', 'sensor.cpt_prochaine', '2026-09-08T09:00:00+02:00', {
        // Attribut publié hors-contrat : une chaîne au lieu d'un tableau.
        // `join` lèverait ici et effacerait toute la carte sans `listAttr`.
        tiers_due: 'marks',
      }),
    ]);
    const el = await mountCard('carnet-scolaire-limiteur', { device_id: 'dev_enfant' }, hass);
    expect(text(el)).toContain('aucun');
  });

  // Sur une instance réelle, la prochaine collecte s'affichait « il y a
  // 38 min » : une échéance passée, lecture légitime (un palier est en
  // retard) mais qui se lit comme une erreur d'affichage et n'apprend rien
  // sur la cause. `overdue_by` et `failing` séparent « rien n'a tourné » de
  // « il tourne et échoue ».
  it('nomme le retard plutôt que d’afficher une échéance passée en relatif', async () => {
    const hass = makeHass([
      compte('sensor:limiter_state', 'sensor.cpt_etat', 'nominal'),
      compte('sensor:next_collection', 'sensor.cpt_prochaine', '2026-09-08T09:00:00+02:00', {
        tiers_due: ['static'],
        overdue_by: 2280,
      }),
    ]);
    const el = await mountCard('carnet-scolaire-limiteur', { device_id: 'dev_enfant' }, hass);
    const t = text(el);
    expect(t).toContain('static');
    expect(t).toContain('en retard de 38 min');
  });

  it('nomme le palier en échec quand `failing` le désigne', async () => {
    const hass = makeHass([
      compte('sensor:limiter_state', 'sensor.cpt_etat', 'nominal'),
      compte('sensor:next_collection', 'sensor.cpt_prochaine', '2026-09-08T09:00:00+02:00', {
        tiers_due: ['static'],
        overdue_by: 600,
        failing: { static: 4 },
      }),
    ]);
    expect(
      text(await mountCard('carnet-scolaire-limiteur', { device_id: 'dev_enfant' }, hass))
    ).toContain('en échec : static');
  });

  it('ne nomme pas deux fois le même palier', async () => {
    // Cas réel : un palier jamais collecté est dû « maintenant », donc son
    // retard vaut zéro alors qu'il échoue depuis le démarrage. La ligne
    // affichait « static · en échec : static ».
    const hass = makeHass([
      compte('sensor:limiter_state', 'sensor.cpt_etat', 'nominal'),
      compte('sensor:next_collection', 'sensor.cpt_prochaine', '2026-09-08T09:00:00+02:00', {
        tiers_due: ['static'],
        overdue_by: 0,
        failing: { static: 2 },
      }),
    ]);
    const t = text(await mountCard('carnet-scolaire-limiteur', { device_id: 'dev_enfant' }, hass));
    expect(t).toContain('en échec : static');
    // Une seule occurrence : celle que porte l'échec.
    expect(t.match(/static/g)).toHaveLength(1);
    // Et jamais « aucun palier en attente » à côté d'un palier en échec.
    expect(t).not.toContain('aucun');
  });

  it('garde les paliers dus que l’échec ne nomme pas', async () => {
    const hass = makeHass([
      compte('sensor:limiter_state', 'sensor.cpt_etat', 'nominal'),
      compte('sensor:next_collection', 'sensor.cpt_prochaine', '2026-09-08T09:00:00+02:00', {
        tiers_due: ['static', 'marks'],
        failing: { static: 2 },
      }),
    ]);
    const t = text(await mountCard('carnet-scolaire-limiteur', { device_id: 'dev_enfant' }, hass));
    expect(t).toContain('marks');
    expect(t).toContain('en échec : static');
  });

  it('ne parle ni de retard ni d’échec quand les attributs sont absents', async () => {
    // Intégration antérieure à ces deux attributs : la ligne reste celle
    // d'avant, relatif compris.
    const hass = makeHass([
      compte('sensor:limiter_state', 'sensor.cpt_etat', 'nominal'),
      compte('sensor:next_collection', 'sensor.cpt_prochaine', '2026-09-08T09:00:00+02:00', {
        tiers_due: ['marks'],
      }),
    ]);
    const t = text(await mountCard('carnet-scolaire-limiteur', { device_id: 'dev_enfant' }, hass));
    expect(t).not.toContain('en retard de');
    expect(t).not.toContain('en échec');
    expect(t).toContain('marks');
  });

  it('dégrade proprement quand `failing` n’est pas un dictionnaire', async () => {
    const hass = makeHass([
      compte('sensor:limiter_state', 'sensor.cpt_etat', 'nominal'),
      compte('sensor:next_collection', 'sensor.cpt_prochaine', '2026-09-08T09:00:00+02:00', {
        tiers_due: ['marks'],
        // Hors-contrat : un tableau au lieu d'un dictionnaire. `Object.keys`
        // rendrait des indices numériques, qui ne nomment aucun palier.
        failing: ['static'],
      }),
    ]);
    const t = text(await mountCard('carnet-scolaire-limiteur', { device_id: 'dev_enfant' }, hass));
    expect(t).not.toContain('en échec');
    expect(t).toContain('marks');
  });
});
